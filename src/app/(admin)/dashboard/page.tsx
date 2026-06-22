import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
        <p className="text-muted-foreground">Manage child profiles, device rules, and live screen requests.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Children</CardTitle>
            <CardDescription>Create profiles and pairing codes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/children">Open children</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>App rules</CardTitle>
            <CardDescription>Block apps by package name per child.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Live screen</CardTitle>
            <CardDescription>Request and track live screen control sessions.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
