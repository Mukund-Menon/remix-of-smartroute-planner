"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  X,
  Navigation,
  MapPin,
  Car,
  Bike,
  Footprints,
  Bus,
  Train,
  Plane,
  Clock,
  DollarSign,
  Route as RouteIcon,
  Loader2,
  Info,
  Users,
  Shield,
  Calendar,
  MessageSquare,
  Leaf,
  LogOut,
  User,
  TrendingDown,
  Zap,
  Target,
  Radius } from
"lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () =>
  <div className="w-full h-full flex items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>

});

type TransportMode = "car" | "cycling" | "walking" | "bus" | "train" | "flight";
type OptimizationMode = "cheapest" | "fastest";

interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  cost: number;
  mode: TransportMode;
  optimizationType?: "shortest" | "fastest" | "cheapest" | "balanced";
}

export default function Home() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [travelTime, setTravelTime] = useState("");
  const [transportMode, setTransportMode] = useState<TransportMode>("car");
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>("fastest");
  const [matchRadius, setMatchRadius] = useState("10");
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [createdTripId, setCreatedTripId] = useState<number | null>(null);

  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();

  const transportModes = [
  { value: "car", label: "Car", icon: Car, color: "#3b82f6" },
  { value: "cycling", label: "Cycling", icon: Bike, color: "#10b981" },
  { value: "walking", label: "Walking", icon: Footprints, color: "#8b5cf6" },
  { value: "bus", label: "Bus", icon: Bus, color: "#f59e0b" },
  { value: "train", label: "Train", icon: Train, color: "#ef4444" },
  { value: "flight", label: "Flight", icon: Plane, color: "#06b6d4" }];


  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error?.code) {
      toast.error("Failed to sign out");
    } else {
      localStorage.removeItem("bearer_token");
      refetch();
      toast.success("Signed out successfully");
      router.push("/");
    }
  };

  const createTrip = async () => {
    setError("");

    // Check if user is authenticated
    if (!session?.user) {
      toast.error("Please sign in to create a trip");
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Validation
    if (!source.trim()) {
      setError("Please enter your starting point");
      return;
    }
    if (!destination.trim()) {
      setError("Please enter a destination");
      return;
    }
    if (!travelDate) {
      setError("Please select a travel date");
      return;
    }
    if (!travelTime) {
      setError("Please select a travel time");
      return;
    }
    
    const radiusValue = parseInt(matchRadius);
    if (isNaN(radiusValue) || radiusValue < 1 || radiusValue > 100) {
      setError("Please enter a valid match radius between 1 and 100 km");
      return;
    }

    setLoading(true);

    try {
      // First calculate the route - get only the primary optimized route
      const routeResponse = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          boardingPoints: [source],
          destination,
          transportMode,
          optimizationMode
        })
      });

      if (!routeResponse.ok) {
        throw new Error("Failed to calculate route");
      }

      const routeData = await routeResponse.json();
      
      // Only show the primary route (first one which is the optimized one)
      const primaryRoute = routeData.routes && routeData.routes.length > 0 ? [routeData.routes[0]] : [];
      setRoutes(primaryRoute);

      // Then create the trip in database with route data and match radius
      const token = localStorage.getItem("bearer_token");
      const tripResponse = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          source,
          destination,
          travelDate,
          travelTime,
          transportMode,
          optimizationMode,
          matchRadius: radiusValue,
          routeData: primaryRoute
        })
      });

      if (!tripResponse.ok) {
        throw new Error("Failed to create trip");
      }

      const trip = await tripResponse.json();
      setCreatedTripId(trip.id);

      toast.success("Trip created! Searching for travel companions...", {
        duration: 5000
      });

      // Check for matches after a short delay
      setTimeout(async () => {
        const matchesResponse = await fetch(`/api/trips/${trip.id}/matches`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (matchesResponse.ok) {
          const matches = await matchesResponse.json();
          if (matches.length > 0) {
            toast.success(`Found ${matches.length} potential travel companion${matches.length > 1 ? 's' : ''}! View in dashboard.`, {
              duration: 7000
            });
          } else {
            toast.info("No matches found yet. We'll notify you when someone creates a similar trip.", {
              duration: 5000
            });
          }
        }
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      toast.error("Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const getOptimizationIcon = (type?: string) => {
    const icons = {
      shortest: Target,
      fastest: Zap,
      cheapest: TrendingDown,
      balanced: RouteIcon
    };
    return icons[type as keyof typeof icons] || RouteIcon;
  };

  const getOptimizationColor = (type?: string) => {
    const colors = {
      shortest: "#10b981",
      fastest: "#3b82f6",
      cheapest: "#f59e0b",
      balanced: "#8b5cf6"
    };
    return colors[type as keyof typeof colors] || "#6b7280";
  };

  const getCurrentModeIcon = () => {
    const mode = transportModes.find((m) => m.value === transportMode);
    return mode ? mode.icon : Car;
  };

  const Icon = getCurrentModeIcon();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center !text-base !font-normal !text-left">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Travel Companion</h1>
              <p className="text-xs text-muted-foreground">Smart Trip Matcher & Safety Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isPending ?
            <Loader2 className="h-4 w-4 animate-spin" /> :
            session?.user ?
            <>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  My Trips
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </> :

            <>
                <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => router.push("/register")}>
                  Get Started
                </Button>
              </>
            }
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full lg:w-96 h-full bg-card border-r border-border overflow-y-auto flex-shrink-0">
          <div className="p-6 space-y-6">
            {/* Hero Section */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Create Your Trip</h2>
              <p className="text-sm text-muted-foreground">
                Find travel companions heading to the same destination. Save costs, travel safely, and reduce your carbon footprint.
              </p>
              
              {/* Feature Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-center">Find Companions</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-xs text-center">Safe Travel</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <Leaf className="h-4 w-4 text-primary" />
                  <span className="text-xs text-center">Eco-Friendly</span>
                </div>
              </div>
            </div>

            {/* Instructions Panel */}
            {showInstructions &&
            <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      Create a trip to find other travelers heading to the same destination. Set your match radius to control how far away potential companions can be.
                    </div>
                    <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2"
                    onClick={() => setShowInstructions(false)}>

                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            }

            {/* Starting Point */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Starting Point
              </label>
              <Input
                placeholder="e.g., New York, NY"
                value={source}
                onChange={(e) => setSource(e.target.value)} />

            </div>

            {/* Destination */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                Destination
              </label>
              <Input
                placeholder="e.g., Los Angeles, CA"
                value={destination}
                onChange={(e) => setDestination(e.target.value)} />

            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </label>
                <Input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} />

              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time
                </label>
                <Input
                  type="time"
                  value={travelTime}
                  onChange={(e) => setTravelTime(e.target.value)} />

              </div>
            </div>

            {/* Match Radius */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Radius className="h-4 w-4" />
                Match Radius (km)
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                placeholder="e.g., 10"
                value={matchRadius}
                onChange={(e) => setMatchRadius(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Find companions within {matchRadius || "10"}km of your route
              </p>
            </div>

            {/* Transport Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred Transport</label>
              <div className="grid grid-cols-3 gap-2">
                {transportModes.map((mode) => {
                  const ModeIcon = mode.icon;
                  return (
                    <Button
                      key={mode.value}
                      variant={transportMode === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTransportMode(mode.value as TransportMode)}
                      className="flex flex-col h-auto py-3 gap-1">

                      <ModeIcon className="h-5 w-5" />
                      <span className="text-xs">{mode.label}</span>
                    </Button>);

                })}
              </div>
            </div>

            {/* Optimization Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Optimize For</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={optimizationMode === "cheapest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptimizationMode("cheapest")}
                  className="flex flex-col h-auto py-3 gap-1">

                  <DollarSign className="h-5 w-5" />
                  <span className="text-xs">Cheapest</span>
                </Button>
                <Button
                  variant={optimizationMode === "fastest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOptimizationMode("fastest")}
                  className="flex flex-col h-auto py-3 gap-1">

                  <Clock className="h-5 w-5" />
                  <span className="text-xs">Fastest</span>
                </Button>
              </div>
            </div>

            {/* Create Trip Button */}
            <Button
              className="w-full"
              onClick={createTrip}
              disabled={loading}
              size="lg">

              {loading ?
              <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Trip...
                </> :

              <>
                  <Icon className="h-4 w-4 mr-2" />
                  Create Trip & Find Matches
                </>
              }
            </Button>

            {/* Error Display */}
            {error &&
            <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            }

            {/* Route Results */}
            {routes.length > 0 &&
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Your Optimized Route</h3>
                  <Badge variant="secondary">
                    {optimizationMode === "cheapest" ? "Cheapest" : "Fastest"}
                  </Badge>
                </div>
                {routes.map((route, index) => {
                const OptIcon = getOptimizationIcon(route.optimizationType);
                const color = getOptimizationColor(route.optimizationType);

                // Calculate eco score (lower is better)
                const ecoScore = route.mode === 'walking' || route.mode === 'cycling' ? 100 :
                route.mode === 'bus' || route.mode === 'train' ? 75 :
                route.mode === 'car' ? 50 : 25;

                return (
                  <Card key={index} className="p-4 space-y-3 border-2" style={{ borderColor: color }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <OptIcon className="h-5 w-5" style={{ color }} />
                          <span className="font-medium capitalize">
                            {route.optimizationType === 'shortest' && 'Shortest Distance'}
                            {route.optimizationType === 'fastest' && 'Fastest Time'}
                            {route.optimizationType === 'cheapest' && 'Cheapest Cost'}
                            {route.optimizationType === 'balanced' && 'Balanced Route'}
                          </span>
                        </div>
                        <Badge style={{ backgroundColor: color, color: 'white' }}>
                          Primary
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Distance
                          </div>
                          <div className="font-medium">{formatDistance(route.distance)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Duration
                          </div>
                          <div className="font-medium">{formatDuration(route.duration)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Cost
                          </div>
                          <div className="font-medium">{formatCost(route.cost)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Leaf className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Eco Score</div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${ecoScore}%` }} />

                          </div>
                        </div>
                        <span className="text-xs font-medium">{ecoScore}%</span>
                      </div>
                    </Card>);

              })}
                {createdTripId &&
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard")}>

                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Trip & Matches in Dashboard
                  </Button>
              }
              </div>
            }
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 h-full relative">
          <MapComponent routes={routes} transportModes={transportModes} />
        </div>
      </div>
    </div>);

}