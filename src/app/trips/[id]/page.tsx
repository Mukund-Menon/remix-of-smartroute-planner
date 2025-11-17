"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Car,
  Bike,
  Footprints,
  Bus,
  Train,
  Plane,
  Users,
  MessageSquare,
  Check,
  X,
  Loader2,
  Route as RouteIcon,
  DollarSign,
  TrendingUp,
  Mail,
  Phone,
  Shield,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

interface Trip {
  id: number;
  userId: string;
  source: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  transportMode: string;
  optimizationMode: string;
  status: string;
  routeData: any;
  routeGeometry: [number, number][] | null;
  sourceCoordinates: string | null;
  destinationCoordinates: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Match {
  id: number;
  tripId: number;
  matchedTripId: number;
  matchScore: number;
  status: string;
  createdAt: string;
  matchedTrip: {
    id: number;
    userId: string;
    source: string;
    destination: string;
    travelDate: string;
    travelTime: string;
    transportMode: string;
    user?: {
      name: string;
      email: string;
      image: string | null;
    };
  };
}

const transportModes = [
  { value: "car", label: "Car", icon: Car, color: "#3b82f6" },
  { value: "cycling", label: "Cycling", icon: Bike, color: "#10b981" },
  { value: "walking", label: "Walking", icon: Footprints, color: "#8b5cf6" },
  { value: "bus", label: "Bus", icon: Bus, color: "#f59e0b" },
  { value: "train", label: "Train", icon: Train, color: "#ef4444" },
  { value: "flight", label: "Flight", icon: Plane, color: "#06b6d4" },
];

export default function TripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingMatch, setAcceptingMatch] = useState<number | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user && tripId) {
      fetchTripDetails();
    }
  }, [session, tripId]);

  const fetchTripDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("bearer_token");

      // Fetch trip details
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!tripResponse.ok) {
        throw new Error("Failed to load trip");
      }

      const tripData = await tripResponse.json();
      setTrip(tripData);

      // Fetch matches
      const matchesResponse = await fetch(`/api/trips/${tripId}/matches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (matchesResponse.ok) {
        const matchesData = await matchesResponse.json();
        setMatches(matchesData);
      }
    } catch (err) {
      toast.error("Failed to load trip details");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptMatch = async (matchId: number) => {
    setAcceptingMatch(matchId);
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/trips/${tripId}/accept-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId }),
      });

      if (!response.ok) {
        throw new Error("Failed to accept match");
      }

      const result = await response.json();
      toast.success(`Group "${result.group.name}" created! You can now chat with your travel companion.`);
      
      // Refresh trip details
      await fetchTripDetails();
      
      // Navigate to group chat
      setTimeout(() => {
        router.push(`/groups/${result.group.id}`);
      }, 1500);
    } catch (err) {
      toast.error("Failed to accept match");
    } finally {
      setAcceptingMatch(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTransportIcon = (mode: string) => {
    const transport = transportModes.find((t) => t.value === mode);
    return transport?.icon || Car;
  };

  const getTransportColor = (mode: string) => {
    const transport = transportModes.find((t) => t.value === mode);
    return transport?.color || "#3b82f6";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getMatchScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    return "Potential Match";
  };

  if (isPending || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Trip not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const TransportIcon = getTransportIcon(trip.transportMode);
  
  // Use routeGeometry if available, otherwise fall back to routeData
  const routes = trip.routeGeometry 
    ? [{
        coordinates: trip.routeGeometry,
        mode: trip.transportMode,
        distance: 0,
        duration: 0,
        cost: 0
      }]
    : (trip.routeData || []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <Badge variant="secondary">{trip.status}</Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Trip Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trip Overview */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Trip Details</h1>
                  <p className="text-sm text-muted-foreground">
                    Created on {formatDate(trip.createdAt)}
                  </p>
                </div>
                <div
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: getTransportColor(trip.transportMode) }}
                >
                  <TransportIcon className="h-6 w-6 text-white" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Starting Point
                    </div>
                    <p className="text-base font-medium">{trip.source}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      Destination
                    </div>
                    <p className="text-base font-medium">{trip.destination}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Date
                    </div>
                    <p className="text-sm font-medium">
                      {formatDate(trip.travelDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Time
                    </div>
                    <p className="text-sm font-medium">
                      {formatTime(trip.travelTime)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TransportIcon className="h-3 w-3" />
                      Transport
                    </div>
                    <p className="text-sm font-medium capitalize">
                      {trip.transportMode}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      Optimize
                    </div>
                    <p className="text-sm font-medium capitalize">
                      {trip.optimizationMode}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Route Map */}
            {routes.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Route Preview</h2>
                <div className="h-96 rounded-lg overflow-hidden border border-border">
                  <MapComponent routes={routes} transportModes={transportModes} />
                </div>
              </Card>
            )}

            {/* Potential Matches */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Potential Travel Companions
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect with travelers heading to the same destination
                  </p>
                </div>
                <Badge variant="secondary">
                  {matches.length} match{matches.length !== 1 ? "es" : ""}
                </Badge>
              </div>

              {matches.length === 0 ? (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    No matches found yet. We'll notify you when travelers heading
                    to the same destination create their trips!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => {
                    const userName = match.matchedTrip.user?.name || "Anonymous User";
                    const userEmail = match.matchedTrip.user?.email || "No email available";
                    const userImage = match.matchedTrip.user?.image || null;
                    
                    return (
                    <Card key={match.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={userImage || undefined} />
                          <AvatarFallback>
                            {getInitials(userName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold">
                                {userName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {userEmail}
                              </p>
                            </div>
                            <Badge
                              className={getMatchScoreColor(match.matchScore)}
                              variant="outline"
                            >
                              {match.matchScore}% {getMatchScoreLabel(match.matchScore)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">
                                {match.matchedTrip.source}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDate(match.matchedTrip.travelDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{formatTime(match.matchedTrip.travelTime)}</span>
                            </div>
                            <div className="flex items-center gap-2 capitalize">
                              {(() => {
                                const Icon = getTransportIcon(match.matchedTrip.transportMode);
                                return <Icon className="h-3 w-3 text-muted-foreground" />;
                              })()}
                              <span>{match.matchedTrip.transportMode}</span>
                            </div>
                          </div>

                          {match.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAcceptMatch(match.id)}
                                disabled={acceptingMatch !== null}
                                className="flex-1"
                              >
                                {acceptingMatch === match.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    Creating Group...
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 mr-2" />
                                    Accept & Create Group
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="w-full justify-center">
                              <Check className="h-3 w-3 mr-1" />
                              {match.status === "accepted" ? "Connected" : "Declined"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Matches</span>
                  <Badge variant="secondary">{matches.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Badge variant="outline">
                    {matches.filter((m) => m.status === "pending").length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <Badge className="bg-green-600">
                    {matches.filter((m) => m.status === "accepted").length}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Safety Tips */}
            <Card className="p-6 bg-muted/50">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-green-600" />
                Safety Reminders
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Meet in public places when first connecting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Share your trip details with emergency contacts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Trust your instincts - report any concerns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Use the group chat to stay connected</span>
                </li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => router.push("/profile")}
              >
                <Shield className="h-4 w-4 mr-2" />
                Update Emergency Contacts
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}