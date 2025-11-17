import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emergencyContacts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    // Validate ID parameter
    const id = params.id;
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid contact ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const contactId = parseInt(id);

    // Check if emergency contact exists and belongs to the user
    const existingContact = await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.id, contactId))
      .limit(1);

    if (existingContact.length === 0) {
      return NextResponse.json(
        { error: 'Emergency contact not found', code: 'CONTACT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingContact[0].userId !== session.user.id) {
      return NextResponse.json(
        {
          error: 'You do not have permission to delete this emergency contact',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Delete the emergency contact
    const deleted = await db
      .delete(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          eq(emergencyContacts.userId, session.user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete emergency contact', code: 'DELETE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Emergency contact deleted successfully',
        deletedContact: deleted[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE emergency contact error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}