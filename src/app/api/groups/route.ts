import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, user } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHENTICATED' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { name, tripId } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ 
        error: 'Name is required and must be a non-empty string',
        code: 'MISSING_NAME' 
      }, { status: 400 });
    }

    // Validate tripId if provided
    if (tripId !== undefined && tripId !== null) {
      const parsedTripId = parseInt(tripId);
      if (isNaN(parsedTripId)) {
        return NextResponse.json({ 
          error: 'Trip ID must be a valid integer',
          code: 'INVALID_TRIP_ID' 
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();

    // Create the group
    const newGroup = await db.insert(groups)
      .values({
        name: name.trim(),
        tripId: tripId ? parseInt(tripId) : null,
        createdBy: session.user.id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (newGroup.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create group',
        code: 'CREATE_FAILED' 
      }, { status: 500 });
    }

    // Add creator as admin member
    await db.insert(groupMembers)
      .values({
        groupId: newGroup[0].id,
        userId: session.user.id,
        role: 'admin',
        joinedAt: now,
      });

    return NextResponse.json(newGroup[0], { status: 201 });

  } catch (error) {
    console.error('POST /api/groups error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHENTICATED' 
      }, { status: 401 });
    }

    // Get all groups where the user is a member
    const userGroupMemberships = await db.select()
      .from(groupMembers)
      .where(eq(groupMembers.userId, session.user.id));

    const groupIds = userGroupMemberships.map(gm => gm.groupId);

    if (groupIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get all groups the user belongs to
    const userGroups = await db.select()
      .from(groups)
      .where(eq(groups.id, groupIds[0]));

    // For multiple group IDs, we need to fetch each separately and combine
    const allGroups = [];
    for (const groupId of groupIds) {
      const groupResult = await db.select()
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);
      
      if (groupResult.length > 0) {
        allGroups.push(groupResult[0]);
      }
    }

    // Enrich each group with member information
    const enrichedGroups = await Promise.all(
      allGroups.map(async (group) => {
        // Get all members for this group
        const members = await db.select({
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
        .leftJoin(user, eq(groupMembers.userId, user.id))
        .where(eq(groupMembers.groupId, group.id));

        // Format members data
        const formattedMembers = members.map(m => ({
          id: m.id,
          groupId: m.groupId,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: {
            id: m.userId,
            name: m.userName,
            email: m.userEmail,
            image: m.userImage,
          }
        }));

        return {
          ...group,
          memberCount: members.length,
          members: formattedMembers,
        };
      })
    );

    return NextResponse.json(enrichedGroups);

  } catch (error) {
    console.error('GET /api/groups error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}