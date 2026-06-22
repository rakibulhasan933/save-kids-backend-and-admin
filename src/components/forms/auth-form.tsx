"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isLogin ? "Login" : "Create admin account"}</CardTitle>
        <CardDescription>{isLogin ? "Access the admin dashboard." : "Register the first admin user."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isLogin ? "No account yet?" : "Already registered?"}{" "}
          <Link className="font-medium text-primary" href={isLogin ? "/register" : "/login"}>
            {isLogin ? "Register" : "Login"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
