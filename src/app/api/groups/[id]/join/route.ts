import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Extract and validate session
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract group id from URL path
    const id = request.nextUrl.pathname.split('/')[3];

    // Validate id is valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid group ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const groupId = parseInt(id);

    // Check if group exists
    const existingGroup = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (existingGroup.length === 0) {
      return NextResponse.json(
        { error: 'Group not found', code: 'GROUP_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { error: 'Already a member of this group', code: 'ALREADY_MEMBER' },
        { status: 400 }
      );
    }

    // Add user to group
    const newMembership = await db
      .insert(groupMembers)
      .values({
        groupId: groupId,
        userId: session.user.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(
      {
        message: 'Successfully joined the group',
        membership: newMembership[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/groups/[id]/join error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}