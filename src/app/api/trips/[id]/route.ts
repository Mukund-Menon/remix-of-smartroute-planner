import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, tripMatches, groups, groupMembers } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Extract userId from session
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse id from URL path
    const id = request.nextUrl.pathname.split('/').slice(-1)[0];

    // Validate id is a valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: 'Valid trip ID is required',
        code: 'INVALID_ID' 
      }, { status: 400 });
    }

    const tripId = parseInt(id);

    // Query trip by id
    const trip = await db.select()
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    // Check if trip exists
    if (trip.length === 0) {
      return NextResponse.json({ 
        error: 'Trip not found',
        code: 'TRIP_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check if user owns the trip
    if (trip[0].userId !== userId) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not own this trip',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Query matched trips with full details
    const matchedTripsData = await db.select({
      matchId: tripMatches.id,
      matchedTripId: tripMatches.matchedTripId,
      matchScore: tripMatches.matchScore,
      matchStatus: tripMatches.status,
      matchCreatedAt: tripMatches.createdAt,
      tripId: trips.id,
      userId: trips.userId,
      source: trips.source,
      destination: trips.destination,
      travelDate: trips.travelDate,
      travelTime: trips.travelTime,
      transportMode: trips.transportMode,
      optimizationMode: trips.optimizationMode,
      status: trips.status,
      routeData: trips.routeData,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
    })
      .from(tripMatches)
      .innerJoin(trips, eq(tripMatches.matchedTripId, trips.id))
      .where(
        and(
          eq(tripMatches.tripId, tripId),
          or(
            eq(tripMatches.status, 'pending'),
            eq(tripMatches.status, 'accepted')
          )
        )
      );

    // Format matched trips
    const matchedTrips = matchedTripsData.map(match => ({
      matchId: match.matchId,
      matchScore: match.matchScore,
      matchStatus: match.matchStatus,
      matchCreatedAt: match.matchCreatedAt,
      trip: {
        id: match.tripId,
        userId: match.userId,
        source: match.source,
        destination: match.destination,
        travelDate: match.travelDate,
        travelTime: match.travelTime,
        transportMode: match.transportMode,
        optimizationMode: match.optimizationMode,
        status: match.status,
        routeData: match.routeData,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      }
    }));

    // Query group info if trip has associated group
    let groupInfo = null;
    const groupData = await db.select({
      groupId: groups.id,
      groupName: groups.name,
      tripId: groups.tripId,
      createdBy: groups.createdBy,
      groupStatus: groups.status,
      groupCreatedAt: groups.createdAt,
      groupUpdatedAt: groups.updatedAt,
      memberId: groupMembers.id,
      memberUserId: groupMembers.userId,
      memberRole: groupMembers.role,
      memberJoinedAt: groupMembers.joinedAt,
    })
      .from(groups)
      .leftJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .where(eq(groups.tripId, tripId));

    if (groupData.length > 0) {
      const group = groupData[0];
      groupInfo = {
        id: group.groupId,
        name: group.groupName,
        tripId: group.tripId,
        createdBy: group.createdBy,
        status: group.groupStatus,
        createdAt: group.groupCreatedAt,
        updatedAt: group.groupUpdatedAt,
        members: groupData
          .filter(row => row.memberId !== null)
          .map(row => ({
            id: row.memberId,
            userId: row.memberUserId,
            role: row.memberRole,
            joinedAt: row.memberJoinedAt,
          }))
      };
    }

    // Return trip with nested data
    return NextResponse.json({
      ...trip[0],
      matchedTrips,
      group: groupInfo,
    }, { status: 200 });

  } catch (error) {
    console.error('GET trip error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Extract userId from session
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse id from URL path
    const id = request.nextUrl.pathname.split('/').slice(-1)[0];

    // Validate id is a valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: 'Valid trip ID is required',
        code: 'INVALID_ID' 
      }, { status: 400 });
    }

    const tripId = parseInt(id);

    // Query trip by id to check ownership
    const existingTrip = await db.select()
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    // Check if trip exists
    if (existingTrip.length === 0) {
      return NextResponse.json({ 
        error: 'Trip not found',
        code: 'TRIP_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check if user owns the trip
    if (existingTrip[0].userId !== userId) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not own this trip',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Get update data from request body
    const updateData = await request.json();

    // Build update object with allowed fields
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    // Only include fields that are allowed to be updated
    const allowedFields = [
      'status',
      'source',
      'destination',
      'travelDate',
      'travelTime',
      'transportMode',
      'optimizationMode',
      'routeData'
    ];

    for (const field of allowedFields) {
      if (field in updateData) {
        updates[field] = updateData[field];
      }
    }

    // Update trip
    const updatedTrip = await db.update(trips)
      .set(updates)
      .where(eq(trips.id, tripId))
      .returning();

    return NextResponse.json(updatedTrip[0], { status: 200 });

  } catch (error) {
    console.error('PUT trip error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Extract userId from session
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse id from URL path
    const id = request.nextUrl.pathname.split('/').slice(-1)[0];

    // Validate id is a valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: 'Valid trip ID is required',
        code: 'INVALID_ID' 
      }, { status: 400 });
    }

    const tripId = parseInt(id);

    // Query trip by id to check ownership
    const existingTrip = await db.select()
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    // Check if trip exists
    if (existingTrip.length === 0) {
      return NextResponse.json({ 
        error: 'Trip not found',
        code: 'TRIP_NOT_FOUND' 
      }, { status: 404 });
    }

    // Check if user owns the trip
    if (existingTrip[0].userId !== userId) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not own this trip',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Delete trip (cascading deletes will remove related tripMatches)
    const deletedTrip = await db.delete(trips)
      .where(eq(trips.id, tripId))
      .returning();

    return NextResponse.json({
      message: 'Trip deleted successfully',
      trip: deletedTrip[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE trip error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}