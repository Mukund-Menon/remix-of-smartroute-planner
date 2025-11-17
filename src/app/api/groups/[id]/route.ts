import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, user, trips } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Extract session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // Extract group id from URL path
    const id = request.nextUrl.pathname.split('/').slice(-1)[0];

    // Validate id is valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid group ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const groupId = parseInt(id);

    // Query group by id
    const groupResult = await db.select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (groupResult.length === 0) {
      return NextResponse.json(
        { error: 'Group not found', code: 'GROUP_NOT_FOUND' },
        { status: 404 }
      );
    }

    const group = groupResult[0];

    // Check if user is a member of this group
    const membershipCheck = await db.select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membershipCheck.length === 0) {
      return NextResponse.json(
        { error: 'Access denied. You are not a member of this group', code: 'NOT_A_MEMBER' },
        { status: 403 }
      );
    }

    // Query all group members with user details
    const membersWithDetails = await db.select({
      id: groupMembers.id,
      groupId: groupMembers.groupId,
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
      .from(groupMembers)
      .innerJoin(user, eq(groupMembers.userId, user.id))
      .where(eq(groupMembers.groupId, groupId));

    // Format members array
    const members = membersWithDetails.map(member => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      name: member.userName,
      email: member.userEmail,
      image: member.userImage,
    }));

    // Query trip details if tripId exists
    let tripDetails = null;
    if (group.tripId) {
      const tripResult = await db.select()
        .from(trips)
        .where(eq(trips.id, group.tripId))
        .limit(1);

      if (tripResult.length > 0) {
        tripDetails = tripResult[0];
      }
    }

    // Return group object with members and trip details
    return NextResponse.json({
      id: group.id,
      name: group.name,
      tripId: group.tripId,
      createdBy: group.createdBy,
      status: group.status,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members,
      memberCount: members.length,
      trip: tripDetails,
    }, { status: 200 });

  } catch (error) {
    console.error('GET group error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}