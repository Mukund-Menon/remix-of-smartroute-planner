"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  cost: number;
  mode: string;
  optimizationType?: "shortest" | "fastest" | "cheapest" | "balanced";
}

interface TransportMode {
  value: string;
  label: string;
  icon: any;
  color: string;
}

interface Waypoint {
  lat: number;
  lon: number;
  type: string;
  userId: string;
  location: string;
}

interface Member {
  userId: string;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
}

interface MapComponentProps {
  routes: RouteData[];
  transportModes: TransportMode[];
  waypoints?: Waypoint[];
  members?: Member[];
}

// Fix for default marker icons in Leaflet
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

function MapUpdater({ routes, waypoints }: { routes: RouteData[]; waypoints?: Waypoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    
    try {
      const allCoordinates: [number, number][] = [];
      
      // Add route coordinates
      if (routes && routes.length > 0) {
        routes.forEach(route => {
          if (route.coordinates && Array.isArray(route.coordinates)) {
            allCoordinates.push(...route.coordinates);
          }
        });
      }
      
      // Add waypoint coordinates
      if (waypoints && waypoints.length > 0) {
        waypoints.forEach(waypoint => {
          allCoordinates.push([waypoint.lat, waypoint.lon]);
        });
      }
      
      if (allCoordinates.length > 0) {
        const bounds = L.latLngBounds(allCoordinates);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error("Error updating map bounds:", error);
    }
  }, [routes, waypoints, map]);

  return null;
}

export default function MapComponent({ routes, transportModes, waypoints, members }: MapComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<L.Map | null>(null);

  // Ensure map only renders on client side
  useEffect(() => {
    setIsClient(true);
    return () => {
      // Cleanup on unmount
      setMapReady(false);
    };
  }, []);

  const getMarkerIcon = (color: string) => {
    try {
      return L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    } catch (error) {
      console.error("Error creating marker icon:", error);
      return L.icon({
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
    }
  };

  const getWaypointIcon = (type: string, index: number) => {
    try {
      const color = type === 'pickup' ? '#22c55e' : '#3b82f6';
      return L.divIcon({
        className: "waypoint-marker",
        html: `
          <div style="
            background-color: ${color};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">${index + 1}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    } catch (error) {
      console.error("Error creating waypoint icon:", error);
      return L.icon({
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
    }
  };

  // Get route color based on optimization type
  const getRouteColor = (optimizationType?: string) => {
    const colorMap = {
      fastest: "#3b82f6", // Blue
      cheapest: "#f59e0b", // Orange
      balanced: "#8b5cf6", // Purple
    };
    return colorMap[optimizationType as keyof typeof colorMap] || "#6b7280";
  };

  // Get route style based on index (first route is primary)
  const getRouteStyle = (index: number, optimizationType?: string) => {
    const isPrimary = index === 0;
    return {
      color: getRouteColor(optimizationType),
      weight: isPrimary ? 5 : 4,
      opacity: isPrimary ? 0.9 : 0.6,
      dashArray: isPrimary ? undefined : "10, 10",
    };
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const getOptimizationLabel = (type?: string) => {
    const labels = {
      fastest: "Fastest Time",
      cheapest: "Cheapest Cost",
      balanced: "Balanced Route",
    };
    return labels[type as keyof typeof labels] || "Route";
  };

  const createRouteLabelIcon = (color: string, label: string) => {
    try {
      return L.divIcon({
        className: "route-label",
        html: `
          <div style="
            background-color: ${color};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">
            ${label}
          </div>
        `,
        iconSize: [100, 20],
        iconAnchor: [50, 10],
      });
    } catch (error) {
      console.error("Error creating route label icon:", error);
      return null;
    }
  };

  const getMemberName = (userId: string) => {
    if (!members) return "Member";
    const member = members.find(m => m.userId === userId);
    return member?.user.name || "Member";
  };

  // Don't render until client-side
  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        whenReady={() => {
          setTimeout(() => setMapReady(true), 100);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {mapReady && routes && routes.length > 0 && routes.map((route, index) => {
          const routeStyle = getRouteStyle(index, route.optimizationType);
          const hasValidCoordinates = route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0;
          
          if (!hasValidCoordinates) return null;
          
          const startPoint = route.coordinates[0];
          const endPoint = route.coordinates[route.coordinates.length - 1];
          const midPoint = route.coordinates[Math.floor(route.coordinates.length / 2)];
          
          return (
            <Fragment key={`route-${index}`}>
              <Polyline
                positions={route.coordinates}
                pathOptions={routeStyle}
              />
              
              {/* Show start/end markers only if no waypoints */}
              {!waypoints && (
                <>
                  {index === 0 && startPoint && (
                    <Marker
                      position={startPoint}
                      icon={getMarkerIcon("#22c55e")}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>Start Point</strong>
                          <br />
                          Mode: {route.mode}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {index === 0 && endPoint && (
                    <Marker
                      position={endPoint}
                      icon={getMarkerIcon("#ef4444")}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>Destination</strong>
                          <br />
                          Mode: {route.mode}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </>
              )}
              
              {route.coordinates.length > 2 && midPoint && !waypoints && (() => {
                const labelIcon = createRouteLabelIcon(routeStyle.color, getOptimizationLabel(route.optimizationType));
                if (!labelIcon) return null;
                
                return (
                  <Marker
                    position={midPoint}
                    icon={labelIcon}
                  >
                    <Popup>
                      <div className="text-sm space-y-1">
                        <div className="font-semibold text-base mb-2">
                          {getOptimizationLabel(route.optimizationType)}
                        </div>
                        <div><strong>Distance:</strong> {formatDistance(route.distance)}</div>
                        <div><strong>Duration:</strong> {formatDuration(route.duration)}</div>
                        <div><strong>Cost:</strong> {formatCost(route.cost)}</div>
                        <div><strong>Mode:</strong> {route.mode}</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })()}
            </Fragment>
          );
        })}
        
        {/* Render waypoints if provided */}
        {mapReady && waypoints && waypoints.length > 0 && waypoints.map((waypoint, index) => (
          <Marker
            key={`waypoint-${index}`}
            position={[waypoint.lat, waypoint.lon]}
            icon={getWaypointIcon(waypoint.type, index)}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-semibold text-base mb-1">
                  Stop #{index + 1}
                </div>
                <div><strong>Type:</strong> {waypoint.type === 'pickup' ? 'Pick up' : 'Drop off'}</div>
                <div><strong>Location:</strong> {waypoint.location}</div>
                <div><strong>Traveler:</strong> {getMemberName(waypoint.userId)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {mapReady && <MapUpdater routes={routes} waypoints={waypoints} />}
      </MapContainer>
    </div>
  );
}