import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { type DataConnection, type MediaConnection } from "peerjs";
import { ref, set, push } from "firebase/database";
import { db } from "@/lib/firebase";
import { useClientId } from "@/hooks/useDbSync";

export type StudentCallStatus =
  | "idle"
  | "ringing"
  | "no-psych"
  | "declined"
  | "connecting"
  | "active"
  | "ended";

export interface LiveMsg {
  id: number;
  role: "user" | "psych";
  text: string;
  time: string;
  sender: string;
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
          ctx.fillStyle = "#16231a";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#3A7A52";
          ctx.font = "bold 24px sans-serif";
          ctx.fillText("Student Call (Audio Only)", 160, 240);
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

export function useStudentCall(userName: string) {
  const [status, setStatus]           = useState<StudentCallStatus>("idle");
  const [roomId, setRoomId]           = useState("");
  const [peerName, setPeerName]       = useState("");
  const [peerId, setPeerId]           = useState("");
  const [messages, setMessages]       = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ roomId: string; psychName: string; note?: string } | null>(null);
  const [overrideAlert, setOverrideAlert] = useState<{ id: number; psychName: string; note: string; timestamp: number } | null>(null);

  const peerRef         = useRef<Peer | null>(null);
  const connRef         = useRef<DataConnection | null>(null);
  const mediaCallRef    = useRef<MediaConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const statusRefState  = useRef<StudentCallStatus>("idle");
  const ringTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statusRefState.current = status;
  }, [status]);

  const rawClientId = useClientId() || "student_" + Math.random().toString(36).substring(7);
  const cleanClientId = rawClientId.replace(/[^a-zA-Z0-9_-]/g, "");

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
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
    setIncomingCall(null);
  }, []);

  // Initialize student's Peer instance
  useEffect(() => {
    const studentPeerId = `soulsync-student-${cleanClientId}`;
    const peer = new Peer(studentPeerId, {
      config: { iceServers: ICE_SERVERS },
      debug: 1,
    });

    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
    });

    peer.on("connection", (conn) => {
      connRef.current = conn;
      conn.on("data", (data: any) => {
        if (!data || typeof data !== "object") return;
        if (data.type === "direct-message") {
          window.dispatchEvent(new CustomEvent("soulsync:incoming-dm", { detail: data }));
        } else if (data.type === "psych-calling" && statusRefState.current === "idle") {
          setIncomingCall({
            roomId: data.roomId,
            psychName: data.psychName || "Dr. Priya Iyer",
            note: data.note,
          });
          setPeerName(data.psychName || "Dr. Priya Iyer");
          setRoomId(data.roomId);
        } else if (data.type === "session-override") {
          setOverrideAlert({
            id: Date.now(),
            psychName: data.psychName || "Dr. Priya Iyer",
            note: data.note || "Priority Clinical Session Override Requested.",
            timestamp: Date.now(),
          });
        }
      });
    });

    peer.on("call", async (incomingMediaCall) => {
      // Psychologist called us with media
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
        setIncomingCall(null);
      });

      incomingMediaCall.on("close", () => {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2000);
      });

      incomingMediaCall.on("error", () => {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2000);
      });
    });

    peer.on("error", (err: any) => {
      console.warn("[PeerJS Student Error]:", err.type, err.message);
      if (err.type === "peer-unavailable") {
        setStatus("no-psych");
        cleanup();
        setTimeout(() => setStatus("idle"), 4000);
      }
    });

    // Multi-tab BroadcastChannel listeners
    let bcCalls: BroadcastChannel | null = null;
    let bcOverrides: BroadcastChannel | null = null;
    try {
      bcCalls = new BroadcastChannel("soulsync_calls");
      bcCalls.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === "psych-calling" && statusRefState.current === "idle") {
          setIncomingCall({
            roomId: data.roomId,
            psychName: data.psychName || "Dr. Priya Iyer",
          });
          setPeerName(data.psychName || "Dr. Priya Iyer");
          setRoomId(data.roomId);
        } else if (data && data.type === "ended" && statusRefState.current !== "idle") {
          cleanup();
          setStatus("ended");
          setTimeout(() => setStatus("idle"), 2000);
        }
      };

      bcOverrides = new BroadcastChannel("soulsync_overrides");
      bcOverrides.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === "session-override") {
          setOverrideAlert({
            id: data.id || Date.now(),
            psychName: data.psychName || "Dr. Priya Iyer",
            note: data.note || "Priority Clinical Session Override Requested.",
            timestamp: data.timestamp || Date.now(),
          });
        }
      };
    } catch (_) {}

    // Window event listeners for same-tab triggers
    const handleDomCall = (e: any) => {
      const data = e.detail;
      if (data && statusRefState.current === "idle") {
        setIncomingCall({
          roomId: data.roomId,
          psychName: data.psychName || "Dr. Priya Iyer",
        });
        setPeerName(data.psychName || "Dr. Priya Iyer");
        setRoomId(data.roomId);
      }
    };
    window.addEventListener("soulsync:psych-calling", handleDomCall);

    const handleDomOverride = (e: any) => {
      const data = e.detail;
      if (data) {
        setOverrideAlert({
          id: data.id || Date.now(),
          psychName: data.psychName || "Dr. Priya Iyer",
          note: data.note || "Priority Clinical Session Override Requested.",
          timestamp: data.timestamp || Date.now(),
        });
      }
    };
    window.addEventListener("soulsync:session-override", handleDomOverride);

    return () => {
      cleanup();
      peer.destroy();
      peerRef.current = null;
      bcCalls?.close();
      bcOverrides?.close();
      window.removeEventListener("soulsync:psych-calling", handleDomCall);
      window.removeEventListener("soulsync:session-override", handleDomOverride);
    };
  }, [cleanClientId, cleanup]);

  // Dial a psychologist
  const dial = useCallback(async (psychName?: string) => {
    if (statusRefState.current !== "idle") return;
    setStatus("ringing");

    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setRoomId(newRoomId);
    const chosenPsych = psychName || "Dr. Priya Iyer";
    setPeerName(chosenPsych);

    // Target the primary psychologist portal (Dr. Priya Iyer)
    const targetPeerId = "soulsync-psych-priya";

    // Prepare local media stream early
    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    const peer = peerRef.current;
    if (peer) {
      // Establish DataConnection for signaling & in-call chat
      const conn = peer.connect(targetPeerId, { reliable: true });
      connRef.current = conn;

      conn.on("open", () => {
        conn.send({
          type: "incoming-call",
          roomId: newRoomId,
          studentPeerId: peer.id,
          userName: userName || "Student",
          psychName: chosenPsych,
        });
      });

      conn.on("data", (data: any) => {
        if (!data || typeof data !== "object") return;

        if (data.type === "call-accepted") {
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          setStatus("connecting");
        } else if (data.type === "call-declined") {
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          setStatus("declined");
          cleanup();
          setTimeout(() => setStatus("idle"), 3500);
        } else if (data.type === "call-ended") {
          setStatus("ended");
          cleanup();
          setTimeout(() => setStatus("idle"), 2000);
        } else if (data.type === "chat-message") {
          if (data.message) {
            setMessages(prev => [...prev, data.message]);
          }
        }
      });

      conn.on("error", () => {
        setStatus("no-psych");
        cleanup();
        setTimeout(() => setStatus("idle"), 4000);
      });
    }

    // Secondary BroadcastChannel fallback for multi-tab testing
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage({
        type: "ringing",
        roomId: newRoomId,
        userName: userName || "Student",
        psychName: chosenPsych,
      });
      bc.close();
    } catch (_) {}

    // Dev server sync fallback
    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ringing", roomId: newRoomId, userName, psychName: chosenPsych }),
    }).catch(() => {});

    // Firebase fallback
    set(ref(db, `calls/${newRoomId}`), {
      status: "ringing",
      userName,
      psychName: chosenPsych,
      timestamp: Date.now(),
    }).catch(() => {});

    // Ringing timeout (35 seconds)
    ringTimeoutRef.current = setTimeout(() => {
      if (statusRefState.current === "ringing") {
        setStatus("no-psych");
        cleanup();
        setTimeout(() => setStatus("idle"), 4000);
      }
    }, 35000);

  }, [userName, cleanup]);

  // End Call
  const endCall = useCallback(() => {
    if (connRef.current?.open) {
      connRef.current.send({ type: "call-ended" });
    }

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

    if (roomId) {
      set(ref(db, `calls/${roomId}/status`), "ended").catch(() => {});
    }

    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, [roomId, cleanup]);

  // Send in-call chat message
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const msg: LiveMsg = {
      id: Date.now(),
      role: "user",
      text: text.trim(),
      sender: userName || "Student",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, msg]);

    if (connRef.current?.open) {
      connRef.current.send({ type: "chat-message", message: msg });
    }

    if (roomId) {
      push(ref(db, `calls/${roomId}/chat`), msg).catch(() => {});
    }
  }, [userName, roomId]);

  // Send direct message outside of call
  const sendDirectMessage = useCallback((text: string, toPsychName?: string) => {
    if (!text.trim()) return;
    const targetPeerId = "soulsync-psych-priya";
    const peer = peerRef.current;
    if (peer && !peer.destroyed) {
      const conn = peer.connect(targetPeerId, { reliable: true });
      conn.on("open", () => {
        conn.send({
          type: "direct-message",
          fromName: userName || "Student",
          fromRole: "user",
          fromPeerId: peer.id,
          toName: toPsychName || "Dr. Priya Iyer",
          text: text.trim(),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        setTimeout(() => conn.close(), 1500);
      });
    }
  }, [userName]);

  // Accept incoming doctor call
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    setStatus("connecting");
    const rid = incomingCall.roomId;
    setRoomId(rid);
    setPeerName(incomingCall.psychName);

    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    // If psychologist called us directly with media connection
    if (mediaCallRef.current) {
      mediaCallRef.current.answer(stream || new MediaStream());
    } else {
      // Connect to psychologist peer if not yet media-connected
      const peer = peerRef.current;
      if (peer) {
        try {
          const mediaCall = peer.call("soulsync-psych-priya", stream || new MediaStream());
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
        } catch (_) {}
      }
    }

    if (connRef.current?.open) {
      connRef.current.send({ type: "call-accepted", roomId: rid });
    }

    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage({ type: "accepted", roomId: rid });
      bc.close();
    } catch (_) {}

    setIncomingCall(null);
    setStatus("active");
  }, [incomingCall, cleanup]);

  // Decline incoming doctor call
  const declineIncomingCall = useCallback(() => {
    if (connRef.current?.open) {
      connRef.current.send({ type: "call-declined" });
    }
    if (incomingCall) {
      try {
        const bc = new BroadcastChannel("soulsync_calls");
        bc.postMessage({ type: "declined", roomId: incomingCall.roomId });
        bc.close();
      } catch (_) {}
    }
    setIncomingCall(null);
    setStatus("idle");
  }, [incomingCall]);

  // Dismiss session override alert
  const dismissOverrideAlert = useCallback(() => {
    setOverrideAlert(null);
  }, []);

  return {
    status,
    roomId,
    peerName,
    peerId,
    messages,
    localStream,
    remoteStream,
    incomingCall,
    overrideAlert,
    dial,
    endCall,
    sendMessage,
    sendDirectMessage,
    acceptIncomingCall,
    declineIncomingCall,
    dismissOverrideAlert,
  };
}


