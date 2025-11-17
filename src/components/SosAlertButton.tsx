"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2, MapPin, Check, Phone } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";

interface SosAlertButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  tripId?: number;
}

export function SosAlertButton({ variant = "destructive", size = "default", className = "", tripId }: SosAlertButtonProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Reverse geocode to get location name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          const locationName = data.display_name || `${lat}, ${lng}`;
          
          setLocation({ lat, lng, name: locationName });
        } catch (err) {
          setLocation({ lat, lng, name: `${lat}, ${lng}` });
        }
        
        setGettingLocation(false);
      },
      (error) => {
        toast.error("Unable to get your location. Please enable location services.");
        setGettingLocation(false);
      }
    );
  };

  useEffect(() => {
    if (isOpen) {
      getCurrentLocation();
    }
  }, [isOpen]);

  const handleSendSOS = async () => {
    if (!location) {
      toast.error("Unable to determine your location");
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch("/api/emergency-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripId: tripId || null,
          locationType: "current",
          currentLocation: location,
          message: `🆘 EMERGENCY ALERT from ${session?.user?.name || "User"}! I need help at ${location.name}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === "NO_EMERGENCY_CONTACTS") {
          toast.error("No emergency contacts configured. Please add contacts in your profile first.");
          setIsOpen(false);
          return;
        }
        throw new Error(errorData.error || "Failed to send SOS alert");
      }

      const data = await response.json();
      
      // Show detailed success message with SMS delivery status
      const smsStatus = data.smsDelivered > 0 
        ? `${data.smsDelivered} SMS message${data.smsDelivered !== 1 ? 's' : ''} delivered successfully`
        : 'SMS messages queued for delivery';
      
      const failureNote = data.smsFailed > 0 
        ? ` (${data.smsFailed} failed - check Twilio configuration)`
        : '';
      
      toast.success(`✅ SOS alert sent to ${data.contactsNotified} contact(s)!`, {
        description: (
          <div className="space-y-1">
            <p className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {smsStatus}{failureNote}
            </p>
            <p className="text-xs">Your emergency contacts have been notified with your location.</p>
          </div>
        ),
        duration: 6000,
      });
      
      setIsOpen(false);
    } catch (err) {
      toast.error("Failed to send SOS alert. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <AlertCircle className="h-4 w-4 mr-2" />
        SOS Alert
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Emergency SOS Alert
            </DialogTitle>
            <DialogDescription>
              This will immediately send an emergency SMS alert with your current location to all your emergency contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {gettingLocation ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Getting your location...
                </span>
              </div>
            ) : location ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">Your Current Location</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {location.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  </div>
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Unable to get your location</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs text-orange-900 flex items-start gap-2">
                <Phone className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>SMS Alert:</strong> Emergency contacts will receive an SMS with your location and a Google Maps link for immediate response.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSendSOS}
              disabled={sending || !location || gettingLocation}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Alert...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Send SOS Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}