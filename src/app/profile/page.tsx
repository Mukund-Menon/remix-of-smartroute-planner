"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Phone,
  AlertCircle,
  Save,
  Loader2,
  ArrowLeft,
  Shield,
  Mail,
  Calendar,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";

interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
  email: string;
  relationship: string | null;
  createdAt: string;
}

interface UserProfile {
  id: number;
  userId: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  travelPreferences: any;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);

  const [phoneData, setPhoneData] = useState({
    phone: "",
  });

  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    relationship: "",
  });

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("bearer_token");

      // Fetch profile
      const profileResponse = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setProfile(data);
        setPhoneData({
          phone: data.phone || "",
        });
      }

      // Fetch emergency contacts
      const contactsResponse = await fetch("/api/emergency-contacts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (contactsResponse.ok) {
        const contacts = await contactsResponse.json();
        setEmergencyContacts(contacts);
      }
    } catch (err) {
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(phoneData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setEditing(false);
      toast.success("Phone number updated successfully");
    } catch (err) {
      toast.error("Failed to update phone number");
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newContact.name || !newContact.phone || !newContact.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch("/api/emergency-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newContact),
      });

      if (!response.ok) {
        throw new Error("Failed to add emergency contact");
      }

      const contact = await response.json();
      setEmergencyContacts([contact, ...emergencyContacts]);
      setNewContact({ name: "", phone: "", email: "", relationship: "" });
      setAddingContact(false);
      toast.success("Emergency contact added successfully");
    } catch (err) {
      toast.error("Failed to add emergency contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm("Are you sure you want to delete this emergency contact?")) {
      return;
    }

    try {
      const token = localStorage.getItem("bearer_token");
      const response = await fetch(`/api/emergency-contacts/${contactId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete emergency contact");
      }

      setEmergencyContacts(emergencyContacts.filter(c => c.id !== contactId));
      toast.success("Emergency contact deleted successfully");
    } catch (err) {
      toast.error("Failed to delete emergency contact");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">My Profile</h1>
              <p className="text-xs text-muted-foreground">
                Manage your account and safety information
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Account Information */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                <p className="text-base font-medium mt-1">
                  {session?.user?.name || "Not set"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <p className="text-base font-medium mt-1">
                  {session?.user?.email || "Not set"}
                </p>
              </div>
            </div>
            {profile && (
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Member Since
                </Label>
                <p className="text-base font-medium mt-1">
                  {formatDate(profile.createdAt)}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </h2>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>

          <form onSubmit={handlePhoneUpdate} className="space-y-4">
            <div>
              <Label htmlFor="phone" className="flex items-center gap-2">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneData.phone}
                onChange={(e) =>
                  setPhoneData({ phone: e.target.value })
                }
                disabled={!editing}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your contact number for trip coordination
              </p>
            </div>

            {editing && (
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    if (profile) {
                      setPhoneData({
                        phone: profile.phone || "",
                      });
                    }
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </Card>

        {/* Emergency Contacts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-600" />
                Emergency Contacts
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                These contacts will receive SOS alerts during emergencies
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingContact(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          <Alert className="mb-4">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Your emergency contacts will only be notified when you trigger an SOS alert.
              We take your privacy seriously.
            </AlertDescription>
          </Alert>

          {/* Add Contact Form */}
          {addingContact && (
            <Card className="p-4 mb-4 border-2 border-primary/20">
              <form onSubmit={handleAddContact} className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add New Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="contactName">Name *</Label>
                    <Input
                      id="contactName"
                      type="text"
                      placeholder="John Doe"
                      value={newContact.name}
                      onChange={(e) =>
                        setNewContact({ ...newContact, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactRelationship">Relationship</Label>
                    <Input
                      id="contactRelationship"
                      type="text"
                      placeholder="Parent, Spouse, Friend"
                      value={newContact.relationship}
                      onChange={(e) =>
                        setNewContact({ ...newContact, relationship: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Phone Number *</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={newContact.phone}
                      onChange={(e) =>
                        setNewContact({ ...newContact, phone: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Email Address *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="john@example.com"
                      value={newContact.email}
                      onChange={(e) =>
                        setNewContact({ ...newContact, email: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} size="sm">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Contact
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddingContact(false);
                      setNewContact({ name: "", phone: "", email: "", relationship: "" });
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Emergency Contacts List */}
          {emergencyContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No emergency contacts added yet</p>
              <p className="text-xs mt-1">
                Add contacts to receive SOS alerts during emergencies
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <Card key={contact.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{contact.name}</h3>
                        {contact.relationship && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {contact.relationship}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Safety Tips */}
        <Card className="p-6 bg-muted/50">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-green-600" />
            Travel Safety Tips
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                Add multiple emergency contacts for better safety coverage
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                Use the SOS button on your dashboard to instantly alert all your emergency contacts
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                Share your trip details with trusted family or friends
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>
                Meet new travel companions in public places first
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Trust your instincts - if something feels wrong, use the SOS alert</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}