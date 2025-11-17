import { NextRequest, NextResponse } from "next/server";

type TransportMode = "car" | "cycling" | "walking" | "bus" | "train" | "flight";
type OptimizationMode = "cheapest" | "fastest";

interface RouteRequest {
  boardingPoints: string[];
  destination: string;
  transportMode: TransportMode;
  optimizationMode: OptimizationMode;
}

interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  cost: number;
  mode: TransportMode;
  optimizationType: "fastest" | "cheapest" | "balanced";
  fuelEfficiency?: number;
  trafficFactor?: number;
  instructions?: Array<{
    distance: number;
    duration: number;
    instruction: string;
    name: string;
    type: string;
  }>;
}

// Map transport modes to OSRM profiles
function mapToOSRMProfile(mode: TransportMode): string {
  const profileMap: Record<TransportMode, string> = {
    car: 'car',
    cycling: 'bike',
    walking: 'foot',
    bus: 'car', // Fallback to car for bus
    train: 'car', // Fallback to car for train
    flight: 'car', // Fallback to car for flight
  };
  return profileMap[mode] || 'car';
}

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

    const data = await response.json();
    
    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      return [parseFloat(lon), parseFloat(lat)];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Calculate multiple alternative routes using OSRM
async function calculateAlternativeRoutes(
  start: [number, number],
  end: [number, number],
  mode: TransportMode
): Promise<Array<{ coordinates: [number, number][]; distance: number; duration: number; instructions?: any[] }>> {
  try {
    const profile = mapToOSRMProfile(mode);
    const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
    
    // Request multiple alternatives from OSRM
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=true&number_of_alternatives=3`,
      {
        headers: {
          'User-Agent': 'TravelCompanionApp/1.0',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('OSRM API error:', response.status, error);
      return [];
    }

    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('No routes found in OSRM response:', data.code);
      return [];
    }

    // Process all alternative routes
    const routes = data.routes.map((route: any) => {
      // Extract coordinates from GeoJSON geometry (already in [lon, lat] format)
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (coord: number[]) => [coord[1], coord[0]] // Convert [lon, lat] to [lat, lon] for Leaflet
      );
      
      // Extract turn-by-turn instructions from legs
      const instructions: any[] = [];
      if (route.legs && route.legs[0]?.steps) {
        route.legs[0].steps.forEach((step: any) => {
          if (step.maneuver) {
            const instruction = formatManeuver(step.maneuver, step.name);
            instructions.push({
              distance: step.distance,
              duration: step.duration,
              instruction: instruction,
              name: step.name || 'Unnamed road',
              type: step.maneuver.type,
            });
          }
        });
      }

      return {
        coordinates: coordinates,
        distance: route.distance, // in meters
        duration: route.duration, // in seconds
        instructions: instructions,
      };
    });

    return routes;
  } catch (error) {
    console.error("Route calculation error:", error);
    return [];
  }
}

// Format OSRM maneuver into human-readable instruction
function formatManeuver(maneuver: any, roadName: string): string {
  const name = roadName || 'the road';
  
  switch (maneuver.type) {
    case 'depart':
      return `Head ${getDirection(maneuver.bearing_after)} on ${name}`;
    case 'arrive':
      return `Arrive at your destination`;
    case 'turn':
      if (maneuver.modifier === 'left') return `Turn left onto ${name}`;
      if (maneuver.modifier === 'right') return `Turn right onto ${name}`;
      if (maneuver.modifier === 'sharp left') return `Sharp left onto ${name}`;
      if (maneuver.modifier === 'sharp right') return `Sharp right onto ${name}`;
      if (maneuver.modifier === 'slight left') return `Slight left onto ${name}`;
      if (maneuver.modifier === 'slight right') return `Slight right onto ${name}`;
      return `Turn onto ${name}`;
    case 'continue':
      return `Continue on ${name}`;
    case 'merge':
      return `Merge onto ${name}`;
    case 'on ramp':
      return `Take the ramp onto ${name}`;
    case 'off ramp':
      return `Take the exit onto ${name}`;
    case 'fork':
      if (maneuver.modifier === 'left') return `Keep left at the fork onto ${name}`;
      if (maneuver.modifier === 'right') return `Keep right at the fork onto ${name}`;
      return `Continue at the fork onto ${name}`;
    case 'roundabout':
    case 'rotary':
      const exit = maneuver.exit || 1;
      return `At the roundabout, take exit ${exit} onto ${name}`;
    case 'end of road':
      if (maneuver.modifier === 'left') return `At the end of the road, turn left onto ${name}`;
      if (maneuver.modifier === 'right') return `At the end of the road, turn right onto ${name}`;
      return `At the end of the road, continue onto ${name}`;
    default:
      return `Continue on ${name}`;
  }
}

// Get cardinal direction from bearing
function getDirection(bearing: number): string {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

// Estimate fuel cost based on distance, mode, and route characteristics
function estimateFuelCost(
  distanceKm: number, 
  mode: TransportMode, 
  routeType: "highway" | "mixed" | "urban" = "mixed"
): number {
  // Fuel efficiency varies by route type (L/100km for car)
  const fuelEfficiencyRates: Record<TransportMode, Record<string, number>> = {
    car: {
      highway: 6.5,    // Best fuel economy on highways
      mixed: 8.0,      // Average mixed driving
      urban: 10.0,     // Worst in city traffic
    },
    cycling: { highway: 0, mixed: 0, urban: 0 },
    walking: { highway: 0, mixed: 0, urban: 0 },
    bus: {
      highway: 2.0,    // Per person fuel cost
      mixed: 2.5,
      urban: 3.0,
    },
    train: {
      highway: 1.5,
      mixed: 1.8,
      urban: 2.0,
    },
    flight: {
      highway: 15.0,
      mixed: 15.0,
      urban: 15.0,
    },
  };
  
  const fuelPricePerLiter = 1.5; // USD per liter
  const efficiency = fuelEfficiencyRates[mode]?.[routeType] || 0;
  const fuelUsed = (distanceKm * efficiency) / 100;
  
  return fuelUsed * fuelPricePerLiter;
}

// Estimate traffic factor based on route characteristics
function estimateTrafficFactor(
  distance: number, 
  duration: number, 
  mode: TransportMode
): number {
  // Calculate average speed
  const avgSpeed = (distance / 1000) / (duration / 3600); // km/h
  
  // Expected speeds for different modes
  const expectedSpeeds: Record<TransportMode, number> = {
    car: 80,      // km/h
    cycling: 20,
    walking: 5,
    bus: 60,
    train: 100,
    flight: 500,
  };
  
  const expected = expectedSpeeds[mode] || 60;
  
  // Traffic factor: 1.0 = no traffic, higher = more traffic/slower
  const trafficFactor = Math.max(1.0, expected / avgSpeed);
  
  return Math.min(trafficFactor, 3.0); // Cap at 3x
}

// Calculate route score for optimization
function calculateRouteScore(
  distance: number,
  duration: number,
  mode: TransportMode,
  optimizationType: "fastest" | "cheapest"
): { cost: number; score: number; fuelEfficiency: number; trafficFactor: number } {
  const distanceKm = distance / 1000;
  const durationHours = duration / 3600;
  const avgSpeed = distanceKm / durationHours;
  
  // Determine route type based on speed
  let routeType: "highway" | "mixed" | "urban" = "mixed";
  if (mode === "car") {
    if (avgSpeed > 70) routeType = "highway";
    else if (avgSpeed < 40) routeType = "urban";
  }
  
  const fuelCost = estimateFuelCost(distanceKm, mode, routeType);
  const trafficFactor = estimateTrafficFactor(distance, duration, mode);
  
  // Calculate fuel efficiency (inverse of fuel cost per km)
  const fuelEfficiency = fuelCost > 0 ? (100 / (fuelCost / distanceKm)) : 100;
  
  let score: number;
  
  if (optimizationType === "cheapest") {
    // For cheapest: prioritize low fuel cost
    // Score = cost (lower is better)
    score = fuelCost;
  } else {
    // For fastest: prioritize short duration and low traffic
    // Score = duration * traffic_factor (lower is better)
    score = duration * trafficFactor;
  }
  
  return {
    cost: fuelCost,
    score: score,
    fuelEfficiency: fuelEfficiency,
    trafficFactor: trafficFactor,
  };
}

// Helper function for Haversine formula
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequest = await request.json();
    const { boardingPoints, destination, transportMode, optimizationMode } = body;

    // Validate input
    if (!boardingPoints || boardingPoints.length === 0) {
      return NextResponse.json(
        { error: "At least one boarding point is required" },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        { error: "Destination is required" },
        { status: 400 }
      );
    }

    console.log("Geocoding locations:", { source: boardingPoints[0], destination });

    // Geocode all locations
    const startCoords = await geocode(boardingPoints[0]);
    const destCoords = await geocode(destination);

    if (!startCoords || !destCoords) {
      return NextResponse.json(
        { error: "Unable to find one or more locations. Please use more specific addresses (e.g., 'New York, NY, USA')" },
        { status: 400 }
      );
    }

    console.log("Geocoded coordinates:", { start: startCoords, dest: destCoords });

    // Calculate multiple alternative routes
    const alternativeRoutes = await calculateAlternativeRoutes(startCoords, destCoords, transportMode);

    if (alternativeRoutes.length === 0) {
      // If OSRM fails, create a simple direct route with estimated data
      console.log("OSRM failed, creating fallback direct route");
      
      // Calculate straight-line distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = toRad(destCoords[1] - startCoords[1]);
      const dLon = toRad(destCoords[0] - startCoords[0]);
      const lat1 = toRad(startCoords[1]);
      const lat2 = toRad(destCoords[1]);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const straightDistance = R * c * 1000; // in meters

      // Create fallback direct route
      const fallbackRoute = {
        coordinates: [startCoords, destCoords],
        distance: straightDistance * 1.3, // Add 30% for actual road distance
        duration: (straightDistance * 1.3) / 1000 / 60 * 60, // Rough estimate: 60 km/h average
        instructions: [
          {
            distance: straightDistance * 1.3,
            duration: (straightDistance * 1.3) / 1000 / 60 * 60,
            instruction: `Head towards ${destination}`,
            name: 'Direct route',
            type: 'depart',
          }
        ]
      };

      alternativeRoutes.push(fallbackRoute);
    }

    // Process alternatives with cost and traffic analysis
    const routes: RouteData[] = [];
    
    // Analyze all routes
    const analyzedRoutes = alternativeRoutes.map(route => {
      const cheapestAnalysis = calculateRouteScore(
        route.distance,
        route.duration,
        transportMode,
        "cheapest"
      );
      
      const fastestAnalysis = calculateRouteScore(
        route.distance,
        route.duration,
        transportMode,
        "fastest"
      );
      
      return {
        route,
        cheapestScore: cheapestAnalysis.score,
        fastestScore: fastestAnalysis.score,
        cost: cheapestAnalysis.cost,
        fuelEfficiency: cheapestAnalysis.fuelEfficiency,
        trafficFactor: cheapestAnalysis.trafficFactor,
      };
    });
    
    // Sort by cost (cheapest fuel cost)
    const sortedByCost = [...analyzedRoutes].sort((a, b) => a.cheapestScore - b.cheapestScore);
    
    // Sort by time with traffic consideration
    const sortedBySpeed = [...analyzedRoutes].sort((a, b) => a.fastestScore - b.fastestScore);
    
    // Add the cheapest route (best fuel efficiency)
    if (sortedByCost[0]) {
      const analyzed = sortedByCost[0];
      routes.push({
        coordinates: analyzed.route.coordinates,
        distance: analyzed.route.distance,
        duration: analyzed.route.duration,
        cost: analyzed.cost,
        mode: transportMode,
        optimizationType: "cheapest",
        fuelEfficiency: analyzed.fuelEfficiency,
        trafficFactor: analyzed.trafficFactor,
        instructions: analyzed.route.instructions,
      });
    }
    
    // Add the fastest route (shortest time with traffic)
    if (sortedBySpeed[0] && sortedBySpeed[0] !== sortedByCost[0]) {
      const analyzed = sortedBySpeed[0];
      routes.push({
        coordinates: analyzed.route.coordinates,
        distance: analyzed.route.distance,
        duration: analyzed.route.duration,
        cost: analyzed.cost,
        mode: transportMode,
        optimizationType: "fastest",
        fuelEfficiency: analyzed.fuelEfficiency,
        trafficFactor: analyzed.trafficFactor,
        instructions: analyzed.route.instructions,
      });
    }
    
    // Add balanced route if we have more alternatives
    if (analyzedRoutes.length > 2) {
      // Find route with best balance (normalized cost + time)
      const balancedRoutes = analyzedRoutes.map(r => ({
        ...r,
        balancedScore: (r.cheapestScore / sortedByCost[0].cheapestScore) + 
                      (r.fastestScore / sortedBySpeed[0].fastestScore)
      })).sort((a, b) => a.balancedScore - b.balancedScore);
      
      const balanced = balancedRoutes[0];
      if (balanced !== sortedByCost[0] && balanced !== sortedBySpeed[0]) {
        routes.push({
          coordinates: balanced.route.coordinates,
          distance: balanced.route.distance,
          duration: balanced.route.duration,
          cost: balanced.cost,
          mode: transportMode,
          optimizationType: "balanced",
          fuelEfficiency: balanced.fuelEfficiency,
          trafficFactor: balanced.trafficFactor,
          instructions: balanced.route.instructions,
        });
      }
    }

    // Sort routes based on user's optimization preference
    let sortedRoutes = routes;
    if (optimizationMode === "fastest") {
      sortedRoutes = routes.sort((a, b) => {
        const aScore = a.duration * (a.trafficFactor || 1);
        const bScore = b.duration * (b.trafficFactor || 1);
        return aScore - bScore;
      });
    } else if (optimizationMode === "cheapest") {
      sortedRoutes = routes.sort((a, b) => a.cost - b.cost);
    }

    console.log(`Returning ${sortedRoutes.length} route(s) optimized for ${optimizationMode}`);
    return NextResponse.json({ routes: sortedRoutes });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while calculating the route" },
      { status: 500 }
    );
  }
}