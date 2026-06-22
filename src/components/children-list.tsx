"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";

type Child = {
  id: string;
  displayName: string;
  pairingCode: string;
  status: "unpaired" | "paired" | "disabled";
  lastSeenAt: string | null;
  createdAt: string;
};

export function ChildrenList() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: () => apiFetch<{ children: Child[] }>("/api/children")
  });

  const createChild = useMutation({
    mutationFn: () =>
      apiFetch("/api/children", {
        method: "POST",
        body: JSON.stringify({ displayName })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setDisplayName("");
      setOpen(false);
      toast.success("Child profile created");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Children</h1>
          <p className="text-muted-foreground">Profiles and pairing codes for child devices.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add child
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add child</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createChild.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
              <Button disabled={createChild.isPending}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pairing code</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead className="w-28">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5}>Loading...</TableCell>
            </TableRow>
          ) : data?.children.length ? (
            data.children.map((child) => (
              <TableRow key={child.id}>
                <TableCell className="font-medium">{child.displayName}</TableCell>
                <TableCell>{child.status}</TableCell>
                <TableCell>{child.pairingCode}</TableCell>
                <TableCell>{child.lastSeenAt ? new Date(child.lastSeenAt).toLocaleString() : "Never"}</TableCell>
                <TableCell>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/children/${child.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5}>No child profiles yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
