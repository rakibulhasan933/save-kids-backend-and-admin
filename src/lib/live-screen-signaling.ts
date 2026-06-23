"use client";

export type ChildLiveScreenState =
  | "IDLE"
  | "PAIRED_IDLE"
  | "MONITORING_ACTIVE"
  | "LIVE_SCREEN_ACTIVE"
  | "LIVE_SCREEN_ENDING"
  | "ERROR";

export type SignalingMessage =
  | { type: "PING"; payload?: Record<string, never> }
  | { type: "PONG"; payload?: Record<string, never> }
  | {
      type: "STATUS_UPDATE";
      payload: {
        childId: string;
        deviceUuid: string;
        state: ChildLiveScreenState | string;
        timestamp: string;
      };
    }
  | { type: "LIVE_SCREEN_ACCEPTED"; payload: { sessionId: string; childId: string } }
  | { type: "LIVE_SCREEN_REJECTED"; payload: { sessionId: string; childId: string; reason: string } }
  | { type: "LIVE_SCREEN_ENDED"; payload: { sessionId: string; childId: string; reason?: string } }
  | { type: "WEBRTC_OFFER"; payload: { sessionId: string; fromRole: "admin" | "child"; sdp: string } }
  | { type: "WEBRTC_ANSWER"; payload: { sessionId: string; fromRole: "admin" | "child"; sdp: string } }
  | {
      type: "WEBRTC_ICE_CANDIDATE";
      payload: { sessionId: string; fromRole: "admin" | "child"; candidate: RTCIceCandidateInit };
    }
  | { type: "ERROR"; payload: { code: string; message: string } };

type Listener = (message: SignalingMessage) => void;

export type AdminSignalingClient = {
  connect: () => Promise<void>;
  close: () => void;
  send: (message: SignalingMessage) => boolean;
  isOpen: () => boolean;
};

type CreateAdminSignalingClientOptions = {
  onMessage: Listener;
  onConnecting?: () => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
};

export function createAdminSignalingClient({
  onMessage,
  onConnecting,
  onOpen,
  onClose,
  onError
}: CreateAdminSignalingClientOptions): AdminSignalingClient {
  let ws: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let connectPromise: Promise<void> | null = null;

  function clearPingTimer() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  }

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (ws?.readyState === WebSocket.CONNECTING && connectPromise) return connectPromise;

    connectPromise = new Promise<void>((resolve, reject) => {
      const url = buildWebSocketUrl();
      console.info("[admin-ws] Connecting", url);
      onConnecting?.();

      const socket = new WebSocket(url);
      ws = socket;
      let settled = false;

      socket.addEventListener("open", () => {
        console.info("[admin-ws] Opened", url);
        settled = true;
        connectPromise = null;
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING", payload: {} }));
          }
        }, 25_000);
        onOpen?.();
        resolve();
      });

      socket.addEventListener("message", (event) => {
        const message = parseSignalingMessage(event.data);
        if (message) onMessage(message);
      });

      socket.addEventListener("close", (event) => {
        console.info("[admin-ws] Closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        clearPingTimer();
        if (ws === socket) ws = null;
        connectPromise = null;
        onClose?.(event);
        if (!settled) {
          settled = true;
          reject(new Error(closeErrorMessage(event)));
        }
      });

      socket.addEventListener("error", (event) => {
        console.error("[admin-ws] Error", event);
        onError?.(event);
        if (!settled) {
          settled = true;
          connectPromise = null;
          reject(new Error("Unable to connect to signaling server"));
        }
      });
    });

    return connectPromise;
  }

  return {
    connect,
    close: () => {
      clearPingTimer();
      ws?.close();
      ws = null;
    },
    send: (message) => {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(message));
      return true;
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN
  };
}

function buildWebSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SIGNALING_WS_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    url.searchParams.set("role", "admin");
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL("/ws", `${protocol}//${window.location.host}`);
  url.searchParams.set("role", "admin");
  return url.toString();
}

function closeErrorMessage(event: CloseEvent) {
  if (event.code === 4001) return "Unable to connect to signaling server: unauthorized";
  if (event.code === 4002) return "Unable to connect to signaling server: invalid auth parameters";
  if (event.reason) return `Unable to connect to signaling server: ${event.reason}`;
  return "Unable to connect to signaling server";
}

function parseSignalingMessage(data: unknown): SignalingMessage | null {
  if (typeof data !== "string") return null;

  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    return parsed as SignalingMessage;
  } catch {
    return null;
  }
}
