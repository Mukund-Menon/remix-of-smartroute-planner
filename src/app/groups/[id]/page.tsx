"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Send,
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  Route as RouteIcon,
  Navigation,
  ChevronDown,
  ChevronUp,
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

interface Message {
  id: number;
  groupId: number;
  userId: string;
  message: string;
  createdAt: string;
  sender: {
    name: string;
    email: string;
    image: string | null;
  };
}

interface GroupMember {
  id: number;
  groupId: number;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
}

interface Group {
  id: number;
  name: string;
  tripId: number | null;
  createdBy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CombinedRoute {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  waypoints: Array<{
    lat: number;
    lon: number;
    type: string;
    userId: string;
    location: string;
  }>;
  transportMode: string;
  memberCount: number;
  trips: Array<{
    id: number;
    userId: string;
    source: string;
    destination: string;
    travelDate: string;
    travelTime: string;
    transportMode: string;
  }>;
}

export default function GroupChatPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [combinedRoute, setCombinedRoute] = useState<CombinedRoute | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user && groupId) {
      fetchGroupData();
      fetchCombinedRoute();
      
      // Set up polling for new messages every 3 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages();
      }, 3000);
      
      // Cleanup polling on unmount
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [session, groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchGroupData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const token = localStorage.getItem("bearer_token");
      
      // Fetch group details
      const groupResponse = await fetch(`/api/groups/${groupId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!groupResponse.ok) {
        throw new Error("Failed to load group");
      }

      const groupData = await groupResponse.json();
      setGroup(groupData);

      // Fetch group members
      const membersResponse = await fetch(`/api/groups/${groupId}/members`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }

      // Fetch messages
      await fetchMessages();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group");
      toast.error("Failed to load group chat");
    } finally {
      setLoading(false);
    }
  };

  const fetchCombinedRoute = async () => {
    setLoadingRoute(true);
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/groups/${groupId}/combined-route`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCombinedRoute(data);
      }
    } catch (err) {
      console.error("Failed to fetch combined route:", err);
    } finally {
      setLoadingRoute(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/groups/${groupId}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      return;
    }

    setSending(true);
    
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const sentMessage = await response.json();
      setMessages([...messages, sentMessage]);
      setNewMessage("");
      messageInputRef.current?.focus();
      
      toast.success("Message sent");
      
    } catch (err) {
      toast.error("Failed to send message");
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isPending || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const routes = combinedRoute ? [{
    coordinates: combinedRoute.coordinates,
    distance: combinedRoute.distance,
    duration: combinedRoute.duration,
    cost: 0,
    mode: combinedRoute.transportMode,
  }] : [];

  const transportModes = [
    { value: "car", label: "Car", icon: null, color: "#3b82f6" },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{group?.name || "Group Chat"}</h1>
              <p className="text-xs text-muted-foreground">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {combinedRoute && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRoute(!showRoute)}
              >
                <RouteIcon className="h-4 w-4 mr-2" />
                {showRoute ? "Hide" : "Show"} Route
                {showRoute ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            )}
            <Badge variant="secondary">
              <Shield className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </div>
      </header>

      {/* Combined Route Section */}
      {showRoute && combinedRoute && (
        <div className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  Combined Travel Route
                </h2>
                <p className="text-sm text-muted-foreground">
                  Optimized route for all {combinedRoute.memberCount} member{combinedRoute.memberCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground">Distance</div>
                  <div className="font-semibold">{formatDistance(combinedRoute.distance)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-semibold">{formatDuration(combinedRoute.duration)}</div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="h-96 rounded-lg overflow-hidden border border-border">
              <MapComponent 
                routes={routes} 
                transportModes={transportModes}
                waypoints={combinedRoute.waypoints}
                members={members}
              />
            </div>

            {/* Waypoints List */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Route Stops</h3>
              <div className="space-y-2">
                {combinedRoute.waypoints.map((waypoint, index) => {
                  const member = members.find(m => m.userId === waypoint.userId);
                  return (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                        waypoint.type === 'pickup' ? 'bg-green-600' : 'bg-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{waypoint.location}</div>
                        <div className="text-xs text-muted-foreground">
                          {waypoint.type === 'pickup' ? 'Pick up' : 'Drop off'} {member?.user.name || 'Member'}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {waypoint.type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium">No messages yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start the conversation with your travel companions
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isOwnMessage = msg.userId === session?.user?.id;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={msg.sender.image || undefined} />
                        <AvatarFallback>
                          {getInitials(msg.sender.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col ${isOwnMessage ? "items-end" : ""} max-w-[70%]`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {isOwnMessage ? "You" : msg.sender.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-border bg-card p-4">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                ref={messageInputRef}
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Members Sidebar */}
        <div className="w-80 border-l border-border bg-card overflow-y-auto hidden lg:block">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-3">Group Members</h2>
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user.image || undefined} />
                        <AvatarFallback>
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.user.name}
                          </p>
                          {member.role === "admin" && (
                            <Badge variant="secondary" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Trip Info */}
            {group?.tripId && (
              <div>
                <h2 className="text-sm font-semibold mb-3">Trip Details</h2>
                <Card className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">View trip details</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/trips/${group.tripId}`)}
                  >
                    View Trip
                  </Button>
                </Card>
              </div>
            )}

            {/* Safety Info */}
            <div>
              <h2 className="text-sm font-semibold mb-3">Safety</h2>
              <Card className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Safe Travel Tips</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                  <li>Share your location with trusted contacts</li>
                  <li>Keep emergency numbers handy</li>
                  <li>Stay connected with your group</li>
                  <li>Report any concerns immediately</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}