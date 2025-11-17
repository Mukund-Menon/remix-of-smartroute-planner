import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, trips } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Calculate optimal combined route for all group members
async function calculateCombinedRoute(memberTrips: any[]) {
  if (memberTrips.length === 0) return null;
  
  // Collect all unique waypoints
  const waypoints: { lat: number; lon: number; type: string; userId: string; location: string }[] = [];
  
  for (const trip of memberTrips) {
    // Add source point
    if (trip.sourceCoordinates) {
      const [lat, lon] = trip.sourceCoordinates.split(',').map(parseFloat);
      waypoints.push({
        lat,
        lon,
        type: 'pickup',
        userId: trip.userId,
        location: trip.source
      });
    }
    
    // Add destination point
    if (trip.destinationCoordinates) {
      const [lat, lon] = trip.destinationCoordinates.split(',').map(parseFloat);
      waypoints.push({
        lat,
        lon,
        type: 'dropoff',
        userId: trip.userId,
        location: trip.destination
      });
    }
  }
  
  if (waypoints.length === 0) return null;
  
  // Sort waypoints to create efficient route
  // Start with first pickup
  const pickups = waypoints.filter(w => w.type === 'pickup');
  const dropoffs = waypoints.filter(w => w.type === 'dropoff');
  
  if (pickups.length === 0 || dropoffs.length === 0) return null;
  
  // Simple optimization: pickup all passengers first, then drop off at destinations
  const orderedWaypoints = [...pickups, ...dropoffs];
  
  // Build coordinate string for OSRM
  const coordinatesString = orderedWaypoints
    .map(wp => `${wp.lon},${wp.lat}`)
    .join(';');
  
  // Get transport mode from first trip
  const transportMode = memberTrips[0].transportMode || 'car';
  const profile = mapToOSRMProfile(transportMode);
  
  try {
    // Calculate route using OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${coordinatesString}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(osrmUrl, {
      headers: {
        'User-Agent': 'TravelCompanionApp/1.0',
      },
    });
    
    if (!response.ok) {
      console.error('OSRM API error:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('OSRM error:', data.code);
      return null;
    }
    
    const route = data.routes[0];
    
    // Convert GeoJSON coordinates from [lon, lat] to [lat, lon]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );
    
    return {
      coordinates,
      distance: route.distance,
      duration: route.duration,
      waypoints: orderedWaypoints,
      transportMode
    };
  } catch (error) {
    console.error('Combined route calculation error:', error);
    return null;
  }
}

function mapToOSRMProfile(mode: string): string {
  const modeMap: Record<string, string> = {
    car: 'car',
    cycling: 'bike',
    walking: 'foot',
    bus: 'car',
    train: 'car',
    flight: 'car',
  };
  return modeMap[mode] || 'car';
}

export async function GET(request: NextRequest) {
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

    // Extract group ID from URL path
    const pathParts = request.nextUrl.pathname.split('/');
    const groupIdParam = pathParts[3];

    // Validate group ID
    if (!groupIdParam || isNaN(parseInt(groupIdParam))) {
      return NextResponse.json(
        { error: 'Valid group ID is required', code: 'INVALID_GROUP_ID' },
        { status: 400 }
      );
    }

    const groupId = parseInt(groupIdParam);

    // Verify user is a member of the group
    const membership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        { error: 'You are not a member of this group', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get all members of the group
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const memberUserIds = members.map(m => m.userId);

    // Get all trips from group members
    const memberTrips = await db
      .select()
      .from(trips)
      .where(
        and(
          inArray(trips.userId, memberUserIds),
          eq(trips.status, 'active')
        )
      );

    if (memberTrips.length === 0) {
      return NextResponse.json(
        { error: 'No active trips found for group members', code: 'NO_TRIPS' },
        { status: 404 }
      );
    }

    // Calculate combined route
    const combinedRoute = await calculateCombinedRoute(memberTrips);

    if (!combinedRoute) {
      return NextResponse.json(
        { error: 'Failed to calculate combined route', code: 'CALCULATION_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...combinedRoute,
      memberCount: memberTrips.length,
      trips: memberTrips.map(t => ({
        id: t.id,
        userId: t.userId,
        source: t.source,
        destination: t.destination,
        travelDate: t.travelDate,
        travelTime: t.travelTime,
        transportMode: t.transportMode
      }))
    }, { status: 200 });

  } catch (error) {
    console.error('GET combined route error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
