import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, tripMatches } from '@/db/schema';
import { eq, and, like, sql, desc, ne } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Geocoding function using Nominatim (OpenStreetMap)
async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TravelCompanionApp/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error("Nominatim API error:", response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      return [lat, lon];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Map transport modes to OSRM profiles
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

// Calculate route using OSRM (OpenStreetMap Routing)
async function calculateRouteGeometry(
  start: [number, number],
  end: [number, number],
  mode: string
): Promise<{ coordinates: [number, number][]; distance: number; duration: number } | null> {
  try {
    const profile = mapToOSRMProfile(mode);
    
    // OSRM expects lon,lat format (not lat,lon)
    const startLonLat = `${start[1]},${start[0]}`;
    const endLonLat = `${end[1]},${end[0]}`;
    
    // Use public OSRM demo server
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLonLat};${endLonLat}?overview=full&geometries=geojson&steps=true`;
    
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
      distance: route.distance, // in meters
      duration: route.duration, // in seconds
    };
  } catch (error) {
    console.error("Route calculation error:", error);
    return null;
  }
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(start: [number, number], end: [number, number]): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(end[0] - start[0]);
  const dLon = toRad(end[1] - start[1]);
  const lat1 = toRad(start[0]);
  const lat2 = toRad(end[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate minimum distance from a point to a route
function distanceToRoute(point: [number, number], routeCoordinates: [number, number][]): number {
  let minDistance = Infinity;
  
  for (const routePoint of routeCoordinates) {
    const distance = calculateDistance(point, routePoint);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
}

// Check if a point is along a route (within threshold)
function isAlongRoute(point: [number, number], routeCoordinates: [number, number][], thresholdKm: number = 5): boolean {
  const distance = distanceToRoute(point, routeCoordinates);
  return distance <= thresholdKm;
}

// Enhanced matching configuration - now accepts matchRadius parameter
function getMatchingConfig(matchRadius: number) {
  return {
    SOURCE_RADIUS_KM: matchRadius,        // Use configurable matchRadius
    DESTINATION_RADIUS_KM: matchRadius,   // Use configurable matchRadius
    ROUTE_PROXIMITY_KM: matchRadius / 2,  // Half of matchRadius
    MIN_MATCH_SCORE: 50                   // Minimum score to create a match
  };
}

// Calculate comprehensive match score with detailed reasons
interface MatchResult {
  score: number;
  reasons: string[];
  details: {
    sourceDistance?: number;
    destinationDistance?: number;
    routeProximity?: number;
  };
}

function calculateMatchScore(
  tripA: {
    sourceCoords: [number, number] | null;
    destCoords: [number, number] | null;
    routeGeometry: [number, number][] | null;
    destination: string;
    travelDate: string;
    transportMode: string;
    matchRadius: number;
  },
  tripB: {
    sourceCoords: [number, number] | null;
    destCoords: [number, number] | null;
    routeGeometry: [number, number][] | null;
    destination: string;
    travelDate: string;
    transportMode: string;
    matchRadius: number;
  }
): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const details: MatchResult['details'] = {};

  // Use the minimum matchRadius between the two trips for fair matching
  const effectiveMatchRadius = Math.min(tripA.matchRadius, tripB.matchRadius);
  const MATCHING_CONFIG = getMatchingConfig(effectiveMatchRadius);

  // Rule 1: Sources within radius (HIGH PRIORITY - 45 points)
  // A's source near B's source = potential pickup together
  if (tripA.sourceCoords && tripB.sourceCoords) {
    const sourceDistance = calculateDistance(tripA.sourceCoords, tripB.sourceCoords);
    details.sourceDistance = sourceDistance;
    
    if (sourceDistance <= MATCHING_CONFIG.SOURCE_RADIUS_KM) {
      const proximityScore = Math.round(45 * (1 - sourceDistance / MATCHING_CONFIG.SOURCE_RADIUS_KM));
      score += proximityScore;
      reasons.push(`starting_points_nearby_${sourceDistance.toFixed(1)}km`);
    }
  }

  // Rule 2: Destinations within radius (HIGH PRIORITY - 45 points)
  // A's destination near B's destination = going to same area
  if (tripA.destCoords && tripB.destCoords) {
    const destDistance = calculateDistance(tripA.destCoords, tripB.destCoords);
    details.destinationDistance = destDistance;
    
    if (destDistance <= MATCHING_CONFIG.DESTINATION_RADIUS_KM) {
      const proximityScore = Math.round(45 * (1 - destDistance / MATCHING_CONFIG.DESTINATION_RADIUS_KM));
      score += proximityScore;
      reasons.push(`destinations_nearby_${destDistance.toFixed(1)}km`);
    }
  }

  // Rule 3: Exact same destination name (bonus 10 points)
  if (tripA.destination.toLowerCase().trim() === tripB.destination.toLowerCase().trim()) {
    score += 10;
    reasons.push('same_destination_name');
  }

  // Rule 4: B's source along A's route (PICKUP - 40 points)
  // A can pick up B along the way
  if (tripB.sourceCoords && tripA.routeGeometry && tripA.routeGeometry.length > 0) {
    const distanceToARoute = distanceToRoute(tripB.sourceCoords, tripA.routeGeometry);
    
    if (distanceToARoute <= MATCHING_CONFIG.ROUTE_PROXIMITY_KM) {
      const proximityScore = Math.round(40 * (1 - distanceToARoute / MATCHING_CONFIG.ROUTE_PROXIMITY_KM));
      score += proximityScore;
      details.routeProximity = distanceToARoute;
      reasons.push(`can_pickup_along_route_${distanceToARoute.toFixed(1)}km`);
    }
  }

  // Rule 5: B's destination along A's route (DROPOFF - 40 points)
  // A can drop off B along the way
  if (tripB.destCoords && tripA.routeGeometry && tripA.routeGeometry.length > 0) {
    const distanceToARoute = distanceToRoute(tripB.destCoords, tripA.routeGeometry);
    
    if (distanceToARoute <= MATCHING_CONFIG.ROUTE_PROXIMITY_KM) {
      const proximityScore = Math.round(40 * (1 - distanceToARoute / MATCHING_CONFIG.ROUTE_PROXIMITY_KM));
      score += proximityScore;
      reasons.push(`can_dropoff_along_route_${distanceToARoute.toFixed(1)}km`);
    }
  }

  // Rule 6: A's source along B's route (REVERSE PICKUP - 35 points)
  // B can pick up A along their way
  if (tripA.sourceCoords && tripB.routeGeometry && tripB.routeGeometry.length > 0) {
    const distanceToBRoute = distanceToRoute(tripA.sourceCoords, tripB.routeGeometry);
    
    if (distanceToBRoute <= MATCHING_CONFIG.ROUTE_PROXIMITY_KM) {
      const proximityScore = Math.round(35 * (1 - distanceToBRoute / MATCHING_CONFIG.ROUTE_PROXIMITY_KM));
      score += proximityScore;
      reasons.push(`they_can_pickup_${distanceToBRoute.toFixed(1)}km`);
    }
  }

  // Rule 7: A's destination along B's route (REVERSE DROPOFF - 35 points)
  // B can drop off A along their way
  if (tripA.destCoords && tripB.routeGeometry && tripB.routeGeometry.length > 0) {
    const distanceToBRoute = distanceToRoute(tripA.destCoords, tripB.routeGeometry);
    
    if (distanceToBRoute <= MATCHING_CONFIG.ROUTE_PROXIMITY_KM) {
      const proximityScore = Math.round(35 * (1 - distanceToBRoute / MATCHING_CONFIG.ROUTE_PROXIMITY_KM));
      score += proximityScore;
      reasons.push(`they_can_dropoff_${distanceToBRoute.toFixed(1)}km`);
    }
  }

  // Rule 8: Same travel date (TIMING - 30 points)
  if (tripA.travelDate === tripB.travelDate) {
    score += 30;
    reasons.push('same_travel_date');
  }

  // Rule 9: Compatible transport mode (MODE - 20 points)
  if (tripA.transportMode.toLowerCase() === tripB.transportMode.toLowerCase()) {
    score += 20;
    reasons.push('same_transport_mode');
  }

  return { score, reasons, details };
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    const requestBody = await request.json();

    // Security check: reject if userId provided in body
    if ('userId' in requestBody || 'user_id' in requestBody) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    const { 
      source, 
      destination, 
      travelDate, 
      travelTime, 
      transportMode, 
      optimizationMode,
      routeData,
      matchRadius
    } = requestBody;

    // Validate required fields
    if (!source || !destination || !travelDate || !travelTime || !transportMode || !optimizationMode) {
      return NextResponse.json({ 
        error: 'Missing required fields: source, destination, travelDate, travelTime, transportMode, optimizationMode',
        code: 'MISSING_REQUIRED_FIELDS' 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedData = {
      source: source.trim(),
      destination: destination.trim(),
      travelDate: travelDate.trim(),
      travelTime: travelTime.trim(),
      transportMode: transportMode.trim(),
      optimizationMode: optimizationMode.trim(),
      routeData: routeData || null,
      matchRadius: matchRadius !== undefined ? parseInt(matchRadius) : 10
    };

    // Validate matchRadius if provided
    if (isNaN(sanitizedData.matchRadius) || sanitizedData.matchRadius < 1 || sanitizedData.matchRadius > 100) {
      return NextResponse.json({ 
        error: 'matchRadius must be a number between 1 and 100',
        code: 'INVALID_MATCH_RADIUS' 
      }, { status: 400 });
    }

    // Geocode source and destination using OpenStreetMap Nominatim
    const sourceCoords = await geocode(sanitizedData.source);
    const destCoords = await geocode(sanitizedData.destination);

    if (!sourceCoords || !destCoords) {
      return NextResponse.json({ 
        error: 'Unable to geocode source or destination. Please provide more specific location names (e.g., "New York, NY" instead of just "New York")',
        code: 'GEOCODING_FAILED' 
      }, { status: 400 });
    }

    // Calculate route geometry using OSRM (OpenStreetMap Routing)
    let routeGeometry = null;
    const route = await calculateRouteGeometry(sourceCoords, destCoords, sanitizedData.transportMode);
    if (route) {
      routeGeometry = route.coordinates;
    }

    // Create trip
    const timestamp = new Date().toISOString();
    const newTrip = await db.insert(trips)
      .values({
        userId: session.user.id,
        source: sanitizedData.source,
        destination: sanitizedData.destination,
        sourceCoordinates: sourceCoords ? `${sourceCoords[0]},${sourceCoords[1]}` : null,
        destinationCoordinates: destCoords ? `${destCoords[0]},${destCoords[1]}` : null,
        travelDate: sanitizedData.travelDate,
        travelTime: sanitizedData.travelTime,
        transportMode: sanitizedData.transportMode,
        optimizationMode: sanitizedData.optimizationMode,
        status: 'active',
        routeData: sanitizedData.routeData,
        routeGeometry: routeGeometry,
        matchRadius: sanitizedData.matchRadius,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .returning();

    if (newTrip.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create trip',
        code: 'CREATION_FAILED' 
      }, { status: 500 });
    }

    const createdTrip = newTrip[0];

    // Run enhanced matching algorithm for carpooling
    try {
      // Find all active trips from other users
      const potentialMatches = await db.select()
        .from(trips)
        .where(
          and(
            eq(trips.status, 'active'),
            ne(trips.userId, session.user.id)
          )
        );

      // Calculate match scores using enhanced algorithm with configurable matchRadius
      const matchInserts = [];
      const matchTimestamp = new Date().toISOString();

      for (const potentialMatch of potentialMatches) {
        // Parse coordinates
        const potentialSourceCoords = potentialMatch.sourceCoordinates 
          ? potentialMatch.sourceCoordinates.split(',').map(parseFloat) as [number, number]
          : null;
        const potentialDestCoords = potentialMatch.destinationCoordinates
          ? potentialMatch.destinationCoordinates.split(',').map(parseFloat) as [number, number]
          : null;
        const potentialRouteGeometry = potentialMatch.routeGeometry as [number, number][] | null;

        // Use enhanced matching algorithm with configurable matchRadius
        const matchResult = calculateMatchScore(
          {
            sourceCoords: sourceCoords,
            destCoords: destCoords,
            routeGeometry: routeGeometry,
            destination: sanitizedData.destination,
            travelDate: sanitizedData.travelDate,
            transportMode: sanitizedData.transportMode,
            matchRadius: sanitizedData.matchRadius
          },
          {
            sourceCoords: potentialSourceCoords,
            destCoords: potentialDestCoords,
            routeGeometry: potentialRouteGeometry,
            destination: potentialMatch.destination,
            travelDate: potentialMatch.travelDate,
            transportMode: potentialMatch.transportMode,
            matchRadius: potentialMatch.matchRadius || 10
          }
        );

        // Get minimum score threshold based on the configurable matchRadius
        const MATCHING_CONFIG = getMatchingConfig(Math.min(sanitizedData.matchRadius, potentialMatch.matchRadius || 10));

        // Only create matches with sufficient score
        if (matchResult.score >= MATCHING_CONFIG.MIN_MATCH_SCORE) {
          // Join reasons into comma-separated string
          const matchReason = matchResult.reasons.join(',');
          
          // Create bidirectional matches
          matchInserts.push(
            // Trip -> Matched Trip
            {
              tripId: createdTrip.id,
              matchedTripId: potentialMatch.id,
              matchScore: matchResult.score,
              status: 'pending',
              createdAt: matchTimestamp
            },
            // Matched Trip -> Trip
            {
              tripId: potentialMatch.id,
              matchedTripId: createdTrip.id,
              matchScore: matchResult.score,
              status: 'pending',
              createdAt: matchTimestamp
            }
          );
          
          // Log match details for debugging
          console.log(`Match found: Trip ${createdTrip.id} <-> ${potentialMatch.id}`);
          console.log(`Score: ${matchResult.score}, Reasons: ${matchReason}`);
          if (matchResult.details.sourceDistance) {
            console.log(`Source distance: ${matchResult.details.sourceDistance.toFixed(2)}km`);
          }
          if (matchResult.details.destinationDistance) {
            console.log(`Destination distance: ${matchResult.details.destinationDistance.toFixed(2)}km`);
          }
          if (matchResult.details.routeProximity) {
            console.log(`Route proximity: ${matchResult.details.routeProximity.toFixed(2)}km`);
          }
        }
      }

      // Insert all matches if any found
      if (matchInserts.length > 0) {
        await db.insert(tripMatches).values(matchInserts);
        console.log(`Created ${matchInserts.length / 2} bidirectional matches for trip ${createdTrip.id}`);
      }
    } catch (matchError) {
      console.error('Matching algorithm error:', matchError);
      // Don't fail the trip creation if matching fails
    }

    return NextResponse.json(createdTrip, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');

    // Build query with userId filter
    let query = db.select().from(trips);

    if (statusFilter) {
      query = query.where(
        and(
          eq(trips.userId, session.user.id),
          eq(trips.status, statusFilter)
        )
      );
    } else {
      query = query.where(eq(trips.userId, session.user.id));
    }

    // Order by createdAt DESC
    const userTrips = await query.orderBy(desc(trips.createdAt));

    // Add match count to each trip
    const tripsWithMatchCount = await Promise.all(
      userTrips.map(async (trip) => {
        const matchCountResult = await db.select({ 
          count: sql<number>`cast(count(*) as integer)` 
        })
          .from(tripMatches)
          .where(
            and(
              eq(tripMatches.tripId, trip.id),
              eq(tripMatches.status, 'pending')
            )
          );

        return {
          ...trip,
          matchCount: matchCountResult[0]?.count || 0
        };
      })
    );

    return NextResponse.json(tripsWithMatchCount, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}