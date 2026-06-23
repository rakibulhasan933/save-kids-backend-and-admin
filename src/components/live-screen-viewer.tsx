"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorUp, PhoneOff, Radio, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import {
  createAdminSignalingClient,
  type AdminSignalingClient,
  type SignalingMessage
} from "@/lib/live-screen-signaling";
import {
  addRemoteIceCandidate,
  closePeerConnection,
  createAdminPeerConnection,
  createAndSetLocalOffer,
  setRemoteAnswer
} from "@/lib/liveScreenWebRTC";

type ViewerStatus = "idle" | "waiting" | "streaming" | "ended";
type SocketStatus = "connecting" | "connected" | "disconnected";
type ChildSignalState = "unknown" | "idle" | "active";

type Child = {
  id: string;
  displayName: string;
  status: "unpaired" | "paired" | "disabled";
  lastSeenAt: string | null;
};

type LiveScreenSession = {
  id: string;
  status: "requested" | "active" | "ended" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  reason: string | null;
};

type RequestResponse = {
  session: LiveScreenSession;
  signaling?: { delivered: number; reason: string | null };
};

export function LiveScreenViewer({ childId, showChildHeader = true }: { childId: string; showChildHeader?: boolean }) {
  const queryClient = useQueryClient();
  const hasValidChildId = childId.trim().length > 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<AdminSignalingClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<ViewerStatus>("idle");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const [status, setStatusState] = useState<ViewerStatus>("idle");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("disconnected");
  const [childSignalState, setChildSignalState] = useState<ChildSignalState>("unknown");
  const [childSignalUpdatedAt, setChildSignalUpdatedAt] = useState<string | null>(null);
  const socketConnected = socketStatus === "connected";
  const childQueryEnabled = hasValidChildId;

  const sessionsQueryKey = useMemo(() => ["live-screen", childId], [childId]);
  const childQuery = useQuery({
    queryKey: ["child", childId],
    queryFn: () => apiFetch<{ child: Child }>(`/api/children/${childId}`),
    enabled: childQueryEnabled
  });
  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: () => apiFetch<{ sessions: LiveScreenSession[] }>(`/api/children/${childId}/live-screen`),
    enabled: hasValidChildId
  });

  const setStatus = useCallback((nextStatus: ViewerStatus) => {
    statusRef.current = nextStatus;
    setStatusState(nextStatus);
  }, []);

  const childPresence = useMemo(
    () => getChildPresence(childQuery.data?.child ?? null, childSignalUpdatedAt),
    [childQuery.data?.child, childSignalUpdatedAt]
  );

  const clearVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
    stream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }, []);

  const closeLocalResources = useCallback(() => {
    closePeerConnection(pcRef.current);
    pcRef.current = null;
    pendingIceRef.current = [];
    clearVideo();
  }, [clearVideo]);

  const cleanupLocalSession = useCallback(
    (nextStatus: ViewerStatus, reason?: string, errorMessage?: string) => {
      closeLocalResources();
      sessionIdRef.current = null;
      setCurrentSessionId(null);
      setEndedReason(reason ?? null);
      setError(errorMessage ?? null);
      setStatus(nextStatus);
      void queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
    [closeLocalResources, queryClient, sessionsQueryKey, setStatus]
  );

  const sendSignaling = useCallback((message: SignalingMessage, errorMessage = "Signaling connection is not available") => {
    const sent = signalingRef.current?.send(message) ?? false;
    if (!sent) {
      toast.error(errorMessage);
      setError(errorMessage);
    }
    return sent;
  }, []);

  const startWebRtcOffer = useCallback(
    async (sessionId: string) => {
      try {
        closePeerConnection(pcRef.current);
        pendingIceRef.current = [];

        const pc = createAdminPeerConnection({
          onTrack: (stream) => {
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            setStatus("streaming");
            void video.play().catch(() => toast.error("Unable to start video playback"));
          },
          onIceCandidate: (candidate) => {
            sendSignaling({
              type: "WEBRTC_ICE_CANDIDATE",
              payload: { sessionId, fromRole: "admin", candidate }
            });
          },
          onConnectionFailed: () => {
            cleanupLocalSession("ended", "webrtc_disconnected", "WebRTC connection disconnected");
          },
          onConnected: () => {
            setStatus("streaming");
          }
        });

        pcRef.current = pc;
        const sdp = await createAndSetLocalOffer(pc);
        const sent = sendSignaling(
          { type: "WEBRTC_OFFER", payload: { sessionId, fromRole: "admin", sdp } },
          "Unable to send WebRTC offer"
        );
        if (!sent) {
          cleanupLocalSession("ended", "signaling_unavailable", "Unable to send WebRTC offer");
        }
      } catch (offerError) {
        const message = offerError instanceof Error ? offerError.message : "Unable to start WebRTC";
        toast.error(message);
        cleanupLocalSession("ended", "webrtc_failed", message);
      }
    },
    [cleanupLocalSession, sendSignaling, setStatus]
  );

  const handleSignalingMessage = useCallback(
    (message: SignalingMessage) => {
      if (message.type === "PONG") return;

      if (message.type === "ERROR") {
        setError(message.payload.message);
        toast.error(message.payload.message);
        return;
      }

      if (message.type === "STATUS_UPDATE") {
        if (message.payload.childId !== childId) return;
        setChildSignalState(normalizeChildSignalState(message.payload.state));
        setChildSignalUpdatedAt(message.payload.timestamp);
        return;
      }

      if (message.type === "LIVE_SCREEN_ACCEPTED") {
        if (message.payload.childId !== childId) return;
        if (sessionIdRef.current && message.payload.sessionId !== sessionIdRef.current) return;
        sessionIdRef.current = message.payload.sessionId;
        setCurrentSessionId(message.payload.sessionId);
        setEndedReason(null);
        setError(null);
        setStatus("waiting");
        void startWebRtcOffer(message.payload.sessionId);
        return;
      }

      if (message.type === "LIVE_SCREEN_REJECTED") {
        if (message.payload.childId !== childId) return;
        if (sessionIdRef.current && message.payload.sessionId !== sessionIdRef.current) return;
        toast.error(`Live screen rejected: ${message.payload.reason}`);
        cleanupLocalSession("idle", message.payload.reason, `Rejected: ${message.payload.reason}`);
        return;
      }

      if (message.type === "LIVE_SCREEN_ENDED") {
        if (message.payload.childId !== childId) return;
        if (sessionIdRef.current && message.payload.sessionId !== sessionIdRef.current) return;
        cleanupLocalSession("ended", message.payload.reason ?? "ended");
        return;
      }

      if (message.type === "WEBRTC_ANSWER") {
        if (sessionIdRef.current && message.payload.sessionId !== sessionIdRef.current) return;
        const pc = pcRef.current;
        if (!pc || message.payload.fromRole !== "child") return;

        void setRemoteAnswer(pc, message.payload.sdp)
          .then(async () => {
            const pending = pendingIceRef.current;
            pendingIceRef.current = [];
            for (const candidate of pending) {
              await addRemoteIceCandidate(pc, candidate);
            }
            setStatus("streaming");
          })
          .catch((answerError) => {
            const text = answerError instanceof Error ? answerError.message : "Unable to apply WebRTC answer";
            toast.error(text);
            cleanupLocalSession("ended", "webrtc_failed", text);
          });
        return;
      }

      if (message.type === "WEBRTC_ICE_CANDIDATE") {
        if (sessionIdRef.current && message.payload.sessionId !== sessionIdRef.current) return;
        const pc = pcRef.current;
        if (!pc || message.payload.fromRole !== "child" || !message.payload.candidate) return;

        if (!pc.remoteDescription) {
          pendingIceRef.current.push(message.payload.candidate);
          return;
        }

        void addRemoteIceCandidate(pc, message.payload.candidate).catch((candidateError) => {
          const text = candidateError instanceof Error ? candidateError.message : "Unable to add ICE candidate";
          toast.error(text);
        });
      }
    },
    [childId, cleanupLocalSession, setStatus, startWebRtcOffer]
  );

  useEffect(() => {
    const client = createAdminSignalingClient({
      onMessage: handleSignalingMessage,
      onConnecting: () => {
        setSocketStatus("connecting");
      },
      onOpen: () => {
        setSocketStatus("connected");
        setError(null);
      },
      onClose: (event) => {
        setSocketStatus("disconnected");
        if (event.code === 4001) {
          setError("Unable to connect to signaling server: unauthorized");
        }
        if (statusRef.current === "waiting" || statusRef.current === "streaming") {
          cleanupLocalSession("ended", "websocket_disconnected", "Signaling connection closed");
        }
      },
      onError: (event) => {
        console.error("[admin-ws] Viewer received WebSocket error", event);
        setSocketStatus("disconnected");
        setError("Unable to connect to signaling server");
      }
    });

    signalingRef.current = client;
    void client.connect().catch((connectError) => {
      const text = connectError instanceof Error ? connectError.message : "Unable to connect to signaling server";
      setError(text);
    });

    return () => {
      client.close();
      closeLocalResources();
    };
  }, [cleanupLocalSession, closeLocalResources, handleSignalingMessage]);

  const reconnectSignaling = useCallback(() => {
    void signalingRef.current?.connect().catch((connectError) => {
      const text = connectError instanceof Error ? connectError.message : "Unable to connect to signaling server";
      setError(text);
    });
  }, []);

  const requestSession = useMutation({
    mutationFn: () => {
      if (!hasValidChildId) {
        throw new Error("Select a child before requesting live screen");
      }

      return apiFetch<RequestResponse>(`/api/children/${childId}/live-screen/request`, { method: "POST" });
    },
    onSuccess: (data) => {
      sessionIdRef.current = data.session.id;
      setCurrentSessionId(data.session.id);
      setEndedReason(null);
      setError(null);
      setStatus("waiting");
      void queryClient.invalidateQueries({ queryKey: sessionsQueryKey });

      if (data.signaling?.delivered === 0) {
        const offlineReason = data.signaling.reason ?? "Child device is offline";
        toast.error(offlineReason);
        setError(offlineReason);
        cleanupLocalSession("idle", data.signaling.reason ?? "child_offline", offlineReason);
      } else {
        toast.success("Live screen requested");
      }
    },
    onError: (requestError) => {
      const text = requestError instanceof Error ? requestError.message : "Unable to request live screen";
      toast.error(text);
      setError(text);
      setStatus("idle");
    }
  });

  const endSession = useMutation({
    mutationFn: async () => {
      if (!currentSessionId) return;

      const endedMessageSent = sendSignaling({
        type: "LIVE_SCREEN_ENDED",
        payload: { sessionId: currentSessionId, childId, reason: "admin_ended" }
      });

      if (!endedMessageSent) {
        await apiFetch(`/api/live-screen/${currentSessionId}/end`, {
          method: "PATCH",
          body: JSON.stringify({ reason: "admin_ended" })
        });
      }
    },
    onSettled: (_data, endError) => {
      cleanupLocalSession("ended", "admin_ended");
      if (endError) {
        const text = endError instanceof Error ? endError.message : "Unable to update session record";
        toast.error(text);
      } else {
        toast.success("Live screen session ended");
      }
    }
  });

  const canRequest =
    hasValidChildId &&
    socketConnected &&
    childPresence.isOnline &&
    childQuery.data?.child.status !== "disabled" &&
    status !== "waiting" &&
    status !== "streaming" &&
    !requestSession.isPending;
  const canEnd = Boolean(currentSessionId) && (status === "waiting" || status === "streaming") && !endSession.isPending;

  return (
    <div className="space-y-6">
      {showChildHeader ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {childQuery.data?.child.displayName ?? "Live screen"}
          </h1>
          <p className="text-muted-foreground">View this child&apos;s screen through a WebRTC session.</p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Live screen</CardTitle>
            <CardDescription>{statusLabel(status, endedReason)}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => requestSession.mutate()} disabled={!canRequest}>
              <MonitorUp className="h-4 w-4" />
              Request live screen
            </Button>
            <Button variant="destructive" onClick={() => endSession.mutate()} disabled={!canEnd}>
              <PhoneOff className="h-4 w-4" />
              End session
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <StatusItem label="Viewer status" value={statusLabel(status, endedReason)} />
            <StatusItem label="Child signal" value={childSignalLabel(childSignalState, childSignalUpdatedAt)} />
            <StatusItem label="Child presence" value={childPresence.label} />
            <StatusItem label="WebSocket" value={socketStatusLabel(socketStatus)} />
            <StatusItem label="Session" value={currentSessionId ? shortId(currentSessionId) : "-"} />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {childPresence.reason ? <p className="text-xs text-muted-foreground">{childPresence.reason}</p> : null}

          <div className="relative aspect-video overflow-hidden rounded-md border bg-black">
            <video ref={videoRef} className="h-full w-full bg-black object-contain" autoPlay playsInline muted />
            {status !== "streaming" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm text-white">
                {status === "waiting" ? <Radio className="h-5 w-5 animate-pulse" /> : <MonitorUp className="h-5 w-5" />}
                <span>{videoPlaceholder(status)}</span>
              </div>
            ) : null}
          </div>

          {socketStatus !== "connected" ? (
            <Button variant="outline" onClick={reconnectSignaling} disabled={socketStatus === "connecting"}>
              <RotateCcw className="h-4 w-4" />
              Reconnect signaling
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Latest live screen session records for this child.</CardDescription>
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
              {sessionsQuery.data?.sessions.length ? (
                sessionsQuery.data.sessions.map((session) => (
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
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function statusLabel(status: ViewerStatus, reason: string | null) {
  if (status === "idle") return "Idle";
  if (status === "waiting") return "Waiting for child";
  if (status === "streaming") return "Streaming";
  return `Ended${reason ? ` (${reason})` : ""}`;
}

function socketStatusLabel(status: SocketStatus) {
  if (status === "connecting") return "Connecting";
  if (status === "connected") return "Connected";
  return "Disconnected";
}

function videoPlaceholder(status: ViewerStatus) {
  if (status === "waiting") return "Waiting for child to accept and send video";
  if (status === "ended") return "Session ended";
  return "No active live screen session";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function normalizeChildSignalState(state: string): ChildSignalState {
  if (state === "IDLE" || state === "PAIRED_IDLE") return "idle";
  if (state === "MONITORING_ACTIVE" || state === "LIVE_SCREEN_ACTIVE" || state === "LIVE_SCREEN_ENDING") {
    return "active";
  }
  return "unknown";
}

function childSignalLabel(state: ChildSignalState, updatedAt: string | null) {
  const freshness = updatedAt ? `, updated ${formatUpdatedAt(updatedAt)}` : "";
  if (state === "idle") return `Idle${freshness}`;
  if (state === "active") return `Active${freshness}`;
  return `Unknown${freshness}`;
}

function getChildPresence(child: Child | null, lastSignalAt: string | null) {
  if (!child) {
    return {
      isOnline: false,
      label: "Unknown",
      reason: "No child data loaded yet"
    };
  }

  if (child.status === "disabled") {
    return {
      isOnline: false,
      label: "Disabled",
      reason: "Child is disabled"
    };
  }

  const signalSource = lastSignalAt ?? child.lastSeenAt;
  if (!signalSource) {
    return {
      isOnline: false,
      label: "Offline",
      reason: "Child considered offline because no STATUS_UPDATE has been received yet"
    };
  }

  const ageMs = Date.now() - new Date(signalSource).getTime();
  if (Number.isNaN(ageMs) || ageMs > CHILD_STATUS_STALE_MS) {
    return {
      isOnline: false,
      label: "Offline",
      reason: `Child considered offline because no STATUS_UPDATE within ${Math.round(
        CHILD_STATUS_STALE_MS / 1000
      )} seconds`
    };
  }

  return {
    isOnline: true,
    label: "Online",
    reason: null
  };
}

function formatUpdatedAt(updatedAt: string) {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return "just now";

  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const CHILD_STATUS_STALE_MS = 120_000;
