import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { type DataConnection, type MediaConnection } from "peerjs";
import { ref, set, push } from "firebase/database";
import { db } from "@/lib/firebase";
import type { LiveMsg } from "./useStudentCall";

export type PsychCallStatus =
  | "idle"
  | "incoming"
  | "connecting"
  | "active"
  | "ended";

export interface IncomingCallInfo {
  roomId: string;
  userSocketId: string; // student's peer ID
  userName: string;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

async function getStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Fallback synthetic stream so call connects even if camera/mic permissions denied
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#112017";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#3A7A52";
          ctx.font = "bold 24px sans-serif";
          ctx.fillText("Dr. Priya Iyer (Clinical Session)", 130, 240);
        }
        const stream = canvas.captureStream(15);
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        return stream;
      } catch {
        return null;
      }
    }
  }
}

export function usePsychCall() {
  const [status, setStatus]             = useState<PsychCallStatus>("idle");
  const [incoming, setIncoming]         = useState<IncomingCallInfo | null>(null);
  const [roomId, setRoomId]             = useState("");
  const [peerName, setPeerName]         = useState("");
  const [peerId, setPeerId]             = useState("");
  const [messages, setMessages]         = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerRef         = useRef<Peer | null>(null);
  const connRef         = useRef<DataConnection | null>(null);
  const mediaCallRef    = useRef<MediaConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const statusRefState  = useRef<PsychCallStatus>("idle");

  useEffect(() => {
    statusRefState.current = status;
  }, [status]);

  // Cleanup helper
  const cleanup = useCallback(() => {
    mediaCallRef.current?.close();
    mediaCallRef.current = null;

    connRef.current?.close();
    connRef.current = null;

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setMessages([]);
    setRoomId("");
    setPeerName("");
    setPeerId("");
    setIncoming(null);
  }, []);

  // Initialize Psychologist Peer (Dr. Priya Iyer)
  useEffect(() => {
    const psychPeerId = "soulsync-psych-priya";
    let isDestroyed = false;

    const initPeer = () => {
      if (isDestroyed) return;

      const peer = new Peer(psychPeerId, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
      });

      peerRef.current = peer;

      peer.on("open", (id) => {
        setPeerId(id);
        console.log("[PeerJS Psych]: Clinical portal online with ID:", id);
      });

      // Handle incoming data connections (ringing / signaling / in-call chat)
      peer.on("connection", (conn) => {
        connRef.current = conn;

        conn.on("data", (data: any) => {
          if (!data || typeof data !== "object") return;

          if (data.type === "incoming-call") {
            if (statusRefState.current === "idle") {
              setIncoming({
                roomId: data.roomId,
                userSocketId: data.studentPeerId,
                userName: data.userName || "Student",
              });
              setPeerName(data.userName || "Student");
              setRoomId(data.roomId);
              setStatus("incoming");
            }
          } else if (data.type === "call-ended") {
            if (statusRefState.current === "incoming") {
              setIncoming(null);
              setStatus("idle");
            } else {
              setStatus("ended");
              cleanup();
              setTimeout(() => setStatus("idle"), 2000);
            }
          } else if (data.type === "chat-message") {
            if (data.message) {
              setMessages(prev => [...prev, data.message]);
            }
          } else if (data.type === "direct-message") {
            window.dispatchEvent(new CustomEvent("soulsync:incoming-dm", { detail: data }));
          }
        });
      });

      // Handle incoming media call (if student initiates)
      peer.on("call", async (incomingMediaCall) => {
        let stream = localStreamRef.current;
        if (!stream) {
          stream = await getStream();
          localStreamRef.current = stream;
          setLocalStream(stream);
        }

        incomingMediaCall.answer(stream || new MediaStream());
        mediaCallRef.current = incomingMediaCall;

        incomingMediaCall.on("stream", (remote) => {
          setRemoteStream(remote);
          setStatus("active");
        });

        incomingMediaCall.on("close", () => {
          setStatus("ended");
          cleanup();
          setTimeout(() => setStatus("idle"), 2000);
        });
      });

      peer.on("error", (err: any) => {
        console.warn("[PeerJS Psych Error]:", err.type, err.message);
        // If ID was temporarily occupied from a quick reload, retry after a delay
        if (err.type === "unavailable-id") {
          setTimeout(() => {
            if (!isDestroyed && (!peerRef.current || peerRef.current.destroyed)) {
              initPeer();
            }
          }, 2000);
        }
      });
    };

    initPeer();

    // BroadcastChannel listener for local multi-tab testing
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === "ringing" && statusRefState.current === "idle") {
          setIncoming({
            roomId: data.roomId,
            userSocketId: "user",
            userName: data.userName || "Student",
          });
          setPeerName(data.userName || "Student");
          setRoomId(data.roomId);
          setStatus("incoming");
        } else if (data && data.type === "ended") {
          cleanup();
          setStatus("ended");
          setTimeout(() => setStatus("idle"), 2000);
        }
      };
      return () => {
        isDestroyed = true;
        bc.close();
        cleanup();
        peerRef.current?.destroy();
        peerRef.current = null;
      };
    } catch (_) {
      return () => {
        isDestroyed = true;
        cleanup();
        peerRef.current?.destroy();
        peerRef.current = null;
      };
    }
  }, [cleanup]);

  // Accept incoming call
  const accept = useCallback(async () => {
    if (!incoming) return;
    setStatus("connecting");
    const rid = incoming.roomId;

    // Acquire psychologist camera / mic stream
    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    // 1. Notify student via PeerJS DataConnection
    if (connRef.current?.open) {
      connRef.current.send({ type: "call-accepted", roomId: rid });
    }

    // 2. Call student with WebRTC media stream
    const peer = peerRef.current;
    if (peer && incoming.userSocketId && incoming.userSocketId !== "user") {
      const mediaCall = peer.call(incoming.userSocketId, stream || new MediaStream());
      mediaCallRef.current = mediaCall;

      mediaCall.on("stream", (remote) => {
        setRemoteStream(remote);
        setStatus("active");
      });

      mediaCall.on("close", () => {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2000);
      });

      mediaCall.on("error", () => {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2000);
      });
    }

    // 3. Fallbacks for local broadcast
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage({ type: "accepted", roomId: rid });
      bc.close();
    } catch (_) {}

    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "accepted", roomId: rid }),
    }).catch(() => {});

    set(ref(db, `calls/${rid}/status`), "active").catch(() => {});

    // Set active status shortly
    setTimeout(() => {
      setStatus("active");
    }, 600);

  }, [incoming, cleanup]);

  // Decline incoming call
  const decline = useCallback(() => {
    if (connRef.current?.open) {
      connRef.current.send({ type: "call-declined" });
    }

    if (incoming) {
      const rid = incoming.roomId;
      try {
        const bc = new BroadcastChannel("soulsync_calls");
        bc.postMessage({ type: "declined", roomId: rid });
        bc.close();
      } catch (_) {}

      fetch("/api/sync/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "declined", roomId: rid }),
      }).catch(() => {});

      set(ref(db, `calls/${rid}/status`), "declined").catch(() => {});
    }

    setIncoming(null);
    setStatus("idle");
  }, [incoming]);

  // End active call
  const endCall = useCallback(() => {
    if (connRef.current?.open) {
      connRef.current.send({ type: "call-ended" });
    }

    if (roomId) {
      try {
        const bc = new BroadcastChannel("soulsync_calls");
        bc.postMessage({ type: "ended", roomId });
        bc.close();
      } catch (_) {}

      fetch("/api/sync/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ended", roomId }),
      }).catch(() => {});

      set(ref(db, `calls/${roomId}/status`), "ended").catch(() => {});
    }

    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, [roomId, cleanup]);

  // Send in-call chat message
  const sendMessage = useCallback((text: string, senderName: string) => {
    if (!text.trim()) return;
    const msg: LiveMsg = {
      id: Date.now(),
      role: "psych",
      text: text.trim(),
      sender: senderName || "Dr. Priya Iyer",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, msg]);

    if (connRef.current?.open) {
      connRef.current.send({ type: "chat-message", message: msg });
    }

    if (roomId) {
      push(ref(db, `calls/${roomId}/chat`), msg).catch(() => {});
    }
  }, [roomId]);

  // Send direct message outside of call
  const sendDirectMessage = useCallback((text: string, toStudentName: string, toStudentPeerId?: string) => {
    if (!text.trim()) return;
    const peer = peerRef.current;
    if (peer && !peer.destroyed) {
      const targetId = toStudentPeerId || connRef.current?.peer;
      if (targetId) {
        const conn = peer.connect(targetId, { reliable: true });
        conn.on("open", () => {
          conn.send({
            type: "direct-message",
            fromName: "Dr. Priya Iyer",
            fromRole: "psych",
            toName: toStudentName,
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          setTimeout(() => conn.close(), 1500);
        });
      }
    }
  }, []);

  return {
    status,
    incoming,
    roomId,
    peerName,
    peerId,
    messages,
    localStream,
    remoteStream,
    accept,
    decline,
    endCall,
    sendMessage,
    sendDirectMessage,
  };
}

