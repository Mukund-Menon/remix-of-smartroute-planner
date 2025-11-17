"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Loader2, Mail, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  const registered = searchParams.get("registered");
  const redirect = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    if (!isPending && session?.user) {
      router.push(redirect);
    }
  }, [session, isPending, router, redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        rememberMe,
        callbackURL: redirect,
      });

      if (error?.code) {
        toast.error("Invalid email or password. Please make sure you have already registered an account and try again.");
        return;
      }

      toast.success("Welcome back!");
      router.push(redirect);
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
          <Users className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Travel Companion</h1>
          <p className="text-xs text-muted-foreground">Smart Trip Matcher & Safety Assistant</p>
        </div>
      </Link>

      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Welcome Back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          {registered && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Account created successfully! Please sign in.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-muted-foreground">
                Remember me
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
