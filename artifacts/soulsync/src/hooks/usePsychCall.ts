import { useState, useEffect, useRef, useCallback } from "react";
import { ref, set, onValue, off, push, onChildAdded, remove, get, query, orderByChild, equalTo } from "firebase/database";
import { db } from "@/lib/firebase";
import { useClientId } from "@/hooks/useDbSync";
import type { LiveMsg } from "./useStudentCall";

export type PsychCallStatus =
  | "idle"
  | "incoming"
  | "connecting"
  | "active"
  | "ended";

export interface IncomingCallInfo {
  roomId: string;
  userSocketId: string;
  userName: string;
}

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

async function getStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try { return await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return null; }
  }
}

export function usePsychCall() {
  const [status, setStatus]               = useState<PsychCallStatus>("idle");
  const [incoming, setIncoming]           = useState<IncomingCallInfo | null>(null);
  const [roomId, setRoomId]               = useState("");
  const [peerName, setPeerName]           = useState("");
  const [peerId, setPeerId]               = useState("");
  const [messages, setMessages]           = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream]     = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteRef      = useRef<MediaStream>(new MediaStream());
  const clientId       = useClientId() || "psych_" + Math.random().toString(36).substring(7);

  const setupPC = useCallback((userSocketId: string, stream: MediaStream | null, rid: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;

    stream?.getTracks().forEach(t => pc.addTrack(t, stream!));

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteRef.current.addTrack(t));
      setRemoteStream(new MediaStream(remoteRef.current.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const iceData = e.candidate.toJSON();
        push(ref(db, `calls/${rid}/iceCandidates/psych`), iceData).catch(() => {});
        fetch("/api/sync/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "ice-candidate", role: "psych", roomId: rid, candidate: iceData }),
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("active");
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setStatus("ended");
      }
    };

    return pc;
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteRef.current = new MediaStream();
    setLocalStream(null);
    setRemoteStream(null);
    setMessages([]);
    setRoomId("");
    setPeerName("");
    setPeerId("");
    setIncoming(null);
  }, []);

  const accept = useCallback(async () => {
    if (!incoming) return;
    setStatus("connecting");
    const rid = incoming.roomId;

    // 1. Dev server sync
    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "accepted", roomId: rid }),
    }).catch(() => {});

    // 2. BroadcastChannel
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage({ type: "accepted", roomId: rid });
      bc.close();
    } catch (_) {}

    // 3. Firebase
    set(ref(db, `calls/${rid}/status`), "active").catch(() => {});
    set(ref(db, `calls/${rid}/psychId`), clientId).catch(() => {});

    setPeerId(incoming.userSocketId);
    setPeerName(incoming.userName);
    setRoomId(rid);
    setIncoming(null);

    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = setupPC(incoming.userSocketId, stream, rid);

    // Listen for Offer on Firebase
    const offerRef = ref(db, `calls/${rid}/offer`);
    onValue(offerRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const answerData = { type: answer.type, sdp: answer.sdp, from: clientId };
        set(ref(db, `calls/${rid}/answer`), answerData).catch(() => {});
        fetch("/api/sync/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "answer", roomId: rid, sdp: answerData }),
        }).catch(() => {});
      }
    }, () => {});

    setTimeout(() => setStatus("active"), 600);

  }, [incoming, setupPC, clientId]);

  const decline = useCallback(() => {
    if (!incoming) return;
    const rid = incoming.roomId;
    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "declined", roomId: rid }),
    }).catch(() => {});

    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage({ type: "declined", roomId: rid });
      bc.close();
    } catch (_) {}

    set(ref(db, `calls/${rid}/status`), "declined").catch(() => {});
    setIncoming(null);
    setStatus("idle");
  }, [incoming]);

  const endCall = useCallback(() => {
    if (roomId) {
      fetch("/api/sync/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ended", roomId }),
      }).catch(() => {});

      try {
        const bc = new BroadcastChannel("soulsync_calls");
        bc.postMessage({ type: "ended", roomId });
        bc.close();
      } catch (_) {}

      set(ref(db, `calls/${roomId}/status`), "ended").catch(() => {});
    }
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2500);
  }, [roomId, cleanup]);

  const sendMessage = useCallback((text: string, senderName: string) => {
    if (!roomId || !text.trim()) return;
    const msg = { role: "psych" as const, text: text.trim(), sender: senderName, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), id: Date.now() };
    setMessages(p => [...p, msg]);

    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat", roomId, ...msg }),
    }).catch(() => {});

    push(ref(db, `calls/${roomId}/chat`), msg).catch(() => {});
  }, [roomId]);

  // Listen for incoming calls & sync events
  useEffect(() => {
    let lastSync = Date.now() - 3000;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/calls?since=${lastSync}`);
        if (res.ok) {
          const events = await res.json();
          if (Array.isArray(events)) {
            lastSync = Date.now();
            for (const ev of events) {
              if (ev.type === "ringing" && status === "idle") {
                setIncoming({
                  roomId: ev.roomId,
                  userSocketId: "user",
                  userName: ev.userName || "Student"
                });
                setStatus("incoming");
              } else if (ev.type === "offer" && ev.roomId === roomId && pcRef.current && !pcRef.current.currentRemoteDescription) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(ev.sdp));
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                const answerData = { type: answer.type, sdp: answer.sdp };
                fetch("/api/sync/calls", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "answer", roomId, sdp: answerData }),
                }).catch(() => {});
                setStatus("active");
              } else if (ev.type === "ice-candidate" && ev.roomId === roomId && ev.role === "user" && pcRef.current) {
                pcRef.current.addIceCandidate(new RTCIceCandidate(ev.candidate)).catch(() => {});
              } else if (ev.type === "ended" && ev.roomId === roomId) {
                cleanup();
                setStatus("ended");
                setTimeout(() => setStatus("idle"), 2000);
              } else if (ev.type === "chat" && ev.roomId === roomId && ev.role === "user") {
                setMessages(prev => [...prev, { id: Date.now(), role: "user", text: ev.text, time: ev.time || "now", sender: ev.sender || "Student" }]);
              }
            }
          }
        }
      } catch (_) {}
    }, 600);

    // BroadcastChannel listener
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === "ringing" && status === "idle") {
          setIncoming({
            roomId: data.roomId,
            userSocketId: "user",
            userName: data.userName || "Student"
          });
          setStatus("incoming");
        } else if (data && data.type === "ended" && data.roomId === roomId) {
          cleanup();
          setStatus("ended");
          setTimeout(() => setStatus("idle"), 2000);
        }
      };
      return () => {
        clearInterval(interval);
        bc.close();
      };
    } catch (_) {
      return () => clearInterval(interval);
    }
  }, [status, roomId, cleanup]);

  return {
    status, incoming, roomId, peerName, peerId,
    messages, localStream, remoteStream,
    accept, decline, endCall, sendMessage,
  };
}
