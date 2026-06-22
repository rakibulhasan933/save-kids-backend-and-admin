"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MonitorUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";

type Child = {
  id: string;
  displayName: string;
  pairingCode: string;
  status: "unpaired" | "paired" | "disabled";
  lastSeenAt: string | null;
  createdAt: string;
};

type AppRule = {
  id: string;
  packageName: string;
  label: string | null;
  isEnabled: boolean;
  createdAt: string;
};

type WebRule = {
  id: string;
  domain: string;
  category: string | null;
  isBlocked: boolean;
  createdAt: string;
};

type LiveScreenSession = {
  id: string;
  status: "requested" | "active" | "ended" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  reason: string | null;
};

export function ChildDetail({ childId }: { childId: string }) {
  const childQuery = useQuery({
    queryKey: ["child", childId],
    queryFn: () => apiFetch<{ child: Child }>(`/api/children/${childId}`)
  });

  if (childQuery.isLoading) return <p>Loading...</p>;
  if (!childQuery.data) return <p>Child not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{childQuery.data.child.displayName}</h1>
        <p className="text-muted-foreground">Manage rules and live screen requests for this child.</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="apps">App rules</TabsTrigger>
          <TabsTrigger value="web">Web rules</TabsTrigger>
          <TabsTrigger value="live">Live screen</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview child={childQuery.data.child} />
        </TabsContent>
        <TabsContent value="apps">
          <AppRules childId={childId} />
        </TabsContent>
        <TabsContent value="web">
          <WebRules childId={childId} />
        </TabsContent>
        <TabsContent value="live">
          <LiveScreen childId={childId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Overview({ child }: { child: Child }) {
  async function copyPairingCode() {
    await navigator.clipboard.writeText(child.pairingCode);
    toast.success("Pairing code copied");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
        <CardDescription>Basic profile and pairing state.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Info label="Status" value={child.status} />
        <Info label="Last seen" value={child.lastSeenAt ? new Date(child.lastSeenAt).toLocaleString() : "Never"} />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Pairing code</p>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-muted px-3 py-2 text-sm font-semibold">{child.pairingCode}</code>
            <Button variant="outline" size="icon" onClick={copyPairingCode} aria-label="Copy pairing code">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Info label="Created" value={new Date(child.createdAt).toLocaleString()} />
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function AppRules({ childId }: { childId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [label, setLabel] = useState("");
  const queryKey = ["app-rules", childId];
  const { data } = useQuery({ queryKey, queryFn: () => apiFetch<{ rules: AppRule[] }>(`/api/children/${childId}/app-rules`) });

  const createRule = useMutation({
    mutationFn: () =>
      apiFetch(`/api/children/${childId}/app-rules`, {
        method: "POST",
        body: JSON.stringify({ packageName, label: label || undefined, isEnabled: true })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
      setPackageName("");
      setLabel("");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <RulesShell
      title="App rules"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add app rule</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createRule.mutate();
              }}
            >
              <Field label="Package name" value={packageName} onChange={setPackageName} required />
              <Field label="Label" value={label} onChange={setLabel} />
              <Button disabled={createRule.isPending}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Package</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.rules.map((rule) => (
            <AppRuleRow key={rule.id} rule={rule} queryKey={queryKey} />
          ))}
        </TableBody>
      </Table>
    </RulesShell>
  );
}

function AppRuleRow({ rule, queryKey }: { rule: AppRule; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (isEnabled: boolean) =>
      apiFetch(`/api/app-rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ isEnabled }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/app-rules/${rule.id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  return (
    <TableRow>
      <TableCell>{rule.packageName}</TableCell>
      <TableCell>{rule.label ?? "-"}</TableCell>
      <TableCell>
        <Switch checked={rule.isEnabled} onCheckedChange={(checked) => update.mutate(checked)} />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => remove.mutate()} aria-label="Delete app rule">
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function WebRules({ childId }: { childId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("");
  const queryKey = ["web-rules", childId];
  const { data } = useQuery({ queryKey, queryFn: () => apiFetch<{ rules: WebRule[] }>(`/api/children/${childId}/web-rules`) });

  const createRule = useMutation({
    mutationFn: () =>
      apiFetch(`/api/children/${childId}/web-rules`, {
        method: "POST",
        body: JSON.stringify({ domain, category: category || undefined, isBlocked: true })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
      setDomain("");
      setCategory("");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <RulesShell
      title="Web rules"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add web rule</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createRule.mutate();
              }}
            >
              <Field label="Domain" value={domain} onChange={setDomain} required />
              <Field label="Category" value={category} onChange={setCategory} />
              <Button disabled={createRule.isPending}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Blocked</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.rules.map((rule) => (
            <WebRuleRow key={rule.id} rule={rule} queryKey={queryKey} />
          ))}
        </TableBody>
      </Table>
    </RulesShell>
  );
}

function WebRuleRow({ rule, queryKey }: { rule: WebRule; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (isBlocked: boolean) =>
      apiFetch(`/api/web-rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ isBlocked }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/web-rules/${rule.id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  return (
    <TableRow>
      <TableCell>{rule.domain}</TableCell>
      <TableCell>{rule.category ?? "-"}</TableCell>
      <TableCell>
        <Switch checked={rule.isBlocked} onCheckedChange={(checked) => update.mutate(checked)} />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => remove.mutate()} aria-label="Delete web rule">
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function LiveScreen({ childId }: { childId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["live-screen", childId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => apiFetch<{ sessions: LiveScreenSession[] }>(`/api/children/${childId}/live-screen`)
  });
  const requestSession = useMutation({
    mutationFn: () => apiFetch(`/api/children/${childId}/live-screen/request`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Live screen requested");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Live screen</CardTitle>
          <CardDescription>Control-layer requests only. Streaming is not implemented yet.</CardDescription>
        </div>
        <Button onClick={() => requestSession.mutate()} disabled={requestSession.isPending}>
          <MonitorUp className="h-4 w-4" />
          Request live screen
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Ended</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.sessions.length ? (
              data.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{session.status}</TableCell>
                  <TableCell>{session.startedAt ? new Date(session.startedAt).toLocaleString() : "-"}</TableCell>
                  <TableCell>{session.endedAt ? new Date(session.endedAt).toLocaleString() : "-"}</TableCell>
                  <TableCell>{session.reason ?? "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>No sessions yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RulesShell({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}
