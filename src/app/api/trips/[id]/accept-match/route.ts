import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, tripMatches, groups, groupMembers } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Extract trip ID from URL path
    const pathParts = request.nextUrl.pathname.split('/');
    const tripIdParam = pathParts[3];

    // Validate trip ID
    if (!tripIdParam || isNaN(parseInt(tripIdParam))) {
      return NextResponse.json(
        { error: 'Valid trip ID is required', code: 'INVALID_TRIP_ID' },
        { status: 400 }
      );
    }

    const tripId = parseInt(tripIdParam);

    // Parse request body - now accepts matchId
    const body = await request.json();
    const { matchId } = body;

    // Validate matchId
    if (!matchId || isNaN(parseInt(matchId))) {
      return NextResponse.json(
        { error: 'Valid match ID is required', code: 'INVALID_MATCH_ID' },
        { status: 400 }
      );
    }

    const matchIdInt = parseInt(matchId);

    // Verify the trip belongs to the authenticated user
    const userTrip = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (userTrip.length === 0) {
      // Check if trip exists at all
      const tripExists = await db
        .select()
        .from(trips)
        .where(eq(trips.id, tripId))
        .limit(1);

      if (tripExists.length === 0) {
        return NextResponse.json(
          { error: 'Trip not found', code: 'TRIP_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'You do not have permission to accept matches for this trip', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const trip = userTrip[0];

    // Look up the match by matchId
    const match = await db
      .select()
      .from(tripMatches)
      .where(eq(tripMatches.id, matchIdInt))
      .limit(1);

    if (match.length === 0) {
      return NextResponse.json(
        { error: 'Trip match not found', code: 'MATCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    const matchRecord = match[0];

    // Verify the match belongs to the user's trip
    if (matchRecord.tripId !== tripId) {
      return NextResponse.json(
        { error: 'Match does not belong to this trip', code: 'MATCH_MISMATCH' },
        { status: 400 }
      );
    }

    const matchedTripId = matchRecord.matchedTripId;

    // Update match status to 'accepted' in both directions
    await db
      .update(tripMatches)
      .set({
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(tripMatches.tripId, tripId),
          eq(tripMatches.matchedTripId, matchedTripId)
        )
      );

    await db
      .update(tripMatches)
      .set({
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(tripMatches.tripId, matchedTripId),
          eq(tripMatches.matchedTripId, tripId)
        )
      );

    // Get the matched trip to find the other user
    const matchedTrip = await db
      .select()
      .from(trips)
      .where(eq(trips.id, matchedTripId))
      .limit(1);

    if (matchedTrip.length === 0) {
      return NextResponse.json(
        { error: 'Matched trip not found', code: 'MATCHED_TRIP_NOT_FOUND' },
        { status: 404 }
      );
    }

    const matchedUserId = matchedTrip[0].userId;

    // Check if a group already exists for either trip
    const existingGroup = await db
      .select()
      .from(groups)
      .where(
        or(
          eq(groups.tripId, tripId),
          eq(groups.tripId, matchedTripId)
        )
      )
      .limit(1);

    let groupResult;

    if (existingGroup.length > 0) {
      // Group exists, add current user if not already a member
      const group = existingGroup[0];

      // Check if user is already a member
      const existingMember = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.userId, userId)
          )
        )
        .limit(1);

      if (existingMember.length === 0) {
        // Add user as member
        await db.insert(groupMembers).values({
          groupId: group.id,
          userId: userId,
          role: 'member',
          joinedAt: new Date().toISOString(),
        });
      }

      // Get all group members
      const members = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));

      groupResult = {
        group,
        members,
      };
    } else {
      // Create new group
      const groupName = `Trip to ${trip.destination} - ${trip.travelDate}`;
      
      const newGroup = await db
        .insert(groups)
        .values({
          name: groupName,
          tripId: tripId,
          createdBy: userId,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      const group = newGroup[0];

      // Add creator as admin
      await db.insert(groupMembers).values({
        groupId: group.id,
        userId: userId,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      });

      // Add matched user as member
      await db.insert(groupMembers).values({
        groupId: group.id,
        userId: matchedUserId,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });

      // Get all group members
      const members = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));

      groupResult = {
        group,
        members,
      };
    }

    return NextResponse.json(groupResult, { status: 200 });
  } catch (error) {
    console.error('POST accept-match error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}