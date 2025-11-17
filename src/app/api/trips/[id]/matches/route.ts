import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, tripMatches, user } from '@/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Extract trip id from URL path
    const id = request.nextUrl.pathname.split('/')[3];

    // Validate id is valid integer
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid trip ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const tripId = parseInt(id);

    // Query trip by id to verify it exists and user owns it
    const trip = await db
      .select()
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    if (trip.length === 0) {
      return NextResponse.json(
        { error: 'Trip not found', code: 'TRIP_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if user owns the trip
    if (trip[0].userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied: You do not own this trip', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Query tripMatches with joined trip and user data
    // CRITICAL: Filter out matches where matchedTripId equals the current tripId (no self-matches)
    const matchesData = await db
      .select({
        matchId: tripMatches.id,
        matchScore: tripMatches.matchScore,
        status: tripMatches.status,
        createdAt: tripMatches.createdAt,
        matchedTrip: {
          id: trips.id,
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
        },
        matchedUser: {
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(tripMatches)
      .innerJoin(trips, eq(tripMatches.matchedTripId, trips.id))
      .innerJoin(user, eq(trips.userId, user.id))
      .where(
        and(
          eq(tripMatches.tripId, tripId),
          ne(tripMatches.matchedTripId, tripId) // Exclude self-matches
        )
      )
      .orderBy(desc(tripMatches.matchScore));

    // Transform to match frontend expectations
    const matches = matchesData.map((match) => ({
      id: match.matchId,
      tripId: tripId,
      matchedTripId: match.matchedTrip.id,
      matchScore: match.matchScore,
      status: match.status,
      createdAt: match.createdAt,
      matchedTrip: {
        ...match.matchedTrip,
        user: match.matchedUser,
      },
    }));

    return NextResponse.json(matches, { status: 200 });
  } catch (error) {
    console.error('GET trip matches error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}