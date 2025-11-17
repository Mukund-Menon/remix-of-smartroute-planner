import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, user } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Extract session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    // Extract group ID from URL path
    const id = request.nextUrl.pathname.split('/')[3];
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: 'Valid group ID is required',
        code: 'INVALID_GROUP_ID' 
      }, { status: 400 });
    }

    const groupId = parseInt(id);

    // Parse request body
    const body = await request.json();
    const { userId: invitedUserId } = body;

    // Validate invited user ID is provided
    if (!invitedUserId) {
      return NextResponse.json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID' 
      }, { status: 400 });
    }

    // Verify group exists
    const groupResult = await db.select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (groupResult.length === 0) {
      return NextResponse.json({ 
        error: 'Group not found',
        code: 'GROUP_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check if current user is an admin of this group
    const adminCheck = await db.select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, session.user.id),
          eq(groupMembers.role, 'admin')
        )
      )
      .limit(1);

    if (adminCheck.length === 0) {
      return NextResponse.json({ 
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED' 
      }, { status: 403 });
    }

    // Verify invited user exists
    const invitedUserResult = await db.select()
      .from(user)
      .where(eq(user.id, invitedUserId))
      .limit(1);

    if (invitedUserResult.length === 0) {
      return NextResponse.json({ 
        error: 'User to invite not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await db.select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, invitedUserId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return NextResponse.json({ 
        error: 'User is already a member',
        code: 'ALREADY_MEMBER' 
      }, { status: 400 });
    }

    // Add user to group
    await db.insert(groupMembers).values({
      groupId,
      userId: invitedUserId,
      role: 'member',
      joinedAt: new Date().toISOString()
    });

    // Query updated group with all members
    const groupWithMembers = await db.select({
      id: groups.id,
      name: groups.name,
      tripId: groups.tripId,
      createdBy: groups.createdBy,
      status: groups.status,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      memberId: groupMembers.id,
      memberUserId: groupMembers.userId,
      memberRole: groupMembers.role,
      memberJoinedAt: groupMembers.joinedAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image
    })
      .from(groups)
      .leftJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .leftJoin(user, eq(groupMembers.userId, user.id))
      .where(eq(groups.id, groupId));

    // Transform the result to include members array
    const groupData = groupWithMembers[0];
    const members = groupWithMembers
      .filter(row => row.memberId !== null)
      .map(row => ({
        id: row.memberId,
        userId: row.memberUserId,
        role: row.memberRole,
        joinedAt: row.memberJoinedAt,
        user: {
          id: row.memberUserId,
          name: row.userName,
          email: row.userEmail,
          image: row.userImage
        }
      }));

    const result = {
      id: groupData.id,
      name: groupData.name,
      tripId: groupData.tripId,
      createdBy: groupData.createdBy,
      status: groupData.status,
      createdAt: groupData.createdAt,
      updatedAt: groupData.updatedAt,
      members
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('POST /api/groups/[id]/invite error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}