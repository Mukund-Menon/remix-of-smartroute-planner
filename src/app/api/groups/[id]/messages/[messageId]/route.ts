import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract group ID and message ID from URL path
    const pathParts = request.nextUrl.pathname.split('/');
    const groupIdParam = pathParts[3];
    const messageIdParam = pathParts[5];

    // Validate group ID
    if (!groupIdParam || isNaN(parseInt(groupIdParam))) {
      return NextResponse.json(
        { error: 'Valid group ID is required', code: 'INVALID_GROUP_ID' },
        { status: 400 }
      );
    }

    // Validate message ID
    if (!messageIdParam || isNaN(parseInt(messageIdParam))) {
      return NextResponse.json(
        { error: 'Valid message ID is required', code: 'INVALID_MESSAGE_ID' },
        { status: 400 }
      );
    }

    const groupId = parseInt(groupIdParam);
    const messageId = parseInt(messageIdParam);

    // Query message by ID
    const messageResult = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    // Check if message exists
    if (messageResult.length === 0) {
      return NextResponse.json(
        { error: 'Message not found', code: 'MESSAGE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = messageResult[0];

    // Verify message belongs to the specified group
    if (message.groupId !== groupId) {
      return NextResponse.json(
        { 
          error: 'Message does not belong to this group', 
          code: 'MESSAGE_NOT_IN_GROUP' 
        },
        { status: 400 }
      );
    }

    // Verify the message was sent by the authenticated user
    if (message.userId !== session.user.id) {
      return NextResponse.json(
        { 
          error: 'Only the sender can delete this message', 
          code: 'NOT_MESSAGE_SENDER' 
        },
        { status: 403 }
      );
    }

    // Delete the message
    const deleted = await db
      .delete(messages)
      .where(eq(messages.id, messageId))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete message', code: 'DELETE_FAILED' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        message: 'Message deleted successfully',
        deletedMessage: {
          id: deleted[0].id,
          groupId: deleted[0].groupId,
          userId: deleted[0].userId,
          message: deleted[0].message,
          createdAt: deleted[0].createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}