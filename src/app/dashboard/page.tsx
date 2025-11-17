"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Loader2,
  Shield,
  User,
  Home,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { useSession, authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { SosAlertButton } from "@/components/SosAlertButton";

interface Trip {
  id: number;
  source: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  transportMode: string;
  status: string;
  matchCount: number;
}

interface Group {
  id: number;
  name: string;
  status: string;
  memberCount: number;
  createdAt: string;
  members: Array<{
    user: {
      name: string;
      email: string;
      image: string | null;
    };
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("bearer_token");

      // Fetch trips
      const tripsResponse = await fetch("/api/trips", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (tripsResponse.ok) {
        const tripsData = await tripsResponse.json();
        setTrips(tripsData);
      }

      // Fetch groups
      const groupsResponse = await fetch("/api/groups", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setGroups(groupsData);
      }
    } catch (err) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">My Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Manage your trips and connections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SosAlertButton variant="destructive" size="sm" />
            <Button variant="outline" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Welcome Section */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome back, {session?.user?.name?.split(" ")[0]}!
              </h2>
              <p className="text-muted-foreground">
                You have {trips.length} trip{trips.length !== 1 ? "s" : ""} and {groups.length} active group{groups.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={() => router.push("/")}>
              Create New Trip
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Trips</p>
                <p className="text-3xl font-bold mt-2">{trips.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Groups</p>
                <p className="text-3xl font-bold mt-2">{groups.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Matches</p>
                <p className="text-3xl font-bold mt-2">
                  {trips.reduce((sum, trip) => sum + trip.matchCount, 0)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Active Groups */}
        {groups.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Travel Groups</h2>
              <Badge variant="secondary">{groups.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="p-5 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/groups/${group.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Created {formatDate(group.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {group.memberCount}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {group.members.slice(0, 3).map((member, idx) => (
                      <Avatar key={idx} className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={member.user.image || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {group.memberCount > 3 && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        +{group.memberCount - 3}
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/groups/${group.id}`);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Open Chat
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Trips */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">My Trips</h2>
            <Badge variant="secondary">{trips.length}</Badge>
          </div>

          {trips.length === 0 ? (
            <Card className="p-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trips yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first trip to start finding travel companions
              </p>
              <Button onClick={() => router.push("/")}>Create Trip</Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <Card
                  key={trip.id}
                  className="p-5 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/trips/${trip.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {trip.source} → {trip.destination}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(trip.travelDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(trip.travelTime)}
                            </span>
                            <Badge variant="outline" className="capitalize">
                              {trip.transportMode}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {trip.matchCount} potential companion{trip.matchCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {trip.matchCount > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            Matches Available
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/trips/${trip.id}`);
                      }}
                    >
                      View Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Safety Reminder */}
        <Card className="p-6 bg-muted/50">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Safety First</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Keep your emergency contacts updated and share your trip details with trusted friends or family.
              </p>
              <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
                Update Safety Info
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}