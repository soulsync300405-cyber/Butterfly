import { useState, useEffect, useRef, useCallback } from "react";
import { ref, set, onValue, off, push, onChildAdded, remove, get } from "firebase/database";
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

export function useStudentCall(userName: string) {
  const [status, setStatus]           = useState<StudentCallStatus>("idle");
  const [roomId, setRoomId]           = useState("");
  const [peerName, setPeerName]       = useState("");
  const [peerId, setPeerId]           = useState("");
  const [messages, setMessages]       = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteRef      = useRef<MediaStream>(new MediaStream());
  const statusRefState = useRef<StudentCallStatus>("idle");

  useEffect(() => {
    statusRefState.current = status;
  }, [status]);

  const clientId = useClientId() || "user_" + Math.random().toString(36).substring(7);

  const setupPC = useCallback((stream: MediaStream | null, rid: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;

    stream?.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteRef.current.addTrack(t));
      setRemoteStream(new MediaStream(remoteRef.current.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const iceData = e.candidate.toJSON();
        push(ref(db, `calls/${rid}/iceCandidates/user`), iceData).catch(() => {});
        fetch("/api/sync/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "ice-user", roomId: rid, candidate: iceData }),
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("active");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("ended");
        cleanup();
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
  }, []);

  // Connect WebRTC with real human psychologist who accepted
  const startLiveWebRTC = useCallback(async (rid: string) => {
    setStatus("connecting");

    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = setupPC(stream, rid);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerData = { type: offer.type, sdp: offer.sdp };
      fetch("/api/sync/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "offer", roomId: rid, sdp: offerData }),
      }).catch(() => {});

      set(ref(db, `calls/${rid}/offer`), offerData).catch(() => {});
    } catch (err) {
      console.warn("[WebRTC] Offer error:", err);
    }
  }, [setupPC]);

  const dial = useCallback(async (psychName?: string) => {
    if (status !== "idle") return;
    setStatus("ringing");

    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setRoomId(newRoomId);
    const chosenPsych = psychName || "Dr. Priya Iyer";
    setPeerName(chosenPsych);

    const ringPayload = {
      type: "ringing",
      roomId: newRoomId,
      userName: userName || "Student",
      psychName: chosenPsych,
    };

    // 1. Dev server sync API
    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ringPayload),
    }).catch(() => {});

    // 2. BroadcastChannel
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.postMessage(ringPayload);
      bc.close();
    } catch (_) {}

    // 3. Firebase
    set(ref(db, `calls/${newRoomId}`), {
      status: "ringing",
      userName: userName,
      offer: { from: clientId }
    }).catch(() => {});

  }, [status, userName, clientId]);

  // Polling & sync listener for call events
  useEffect(() => {
    if (!roomId) return;

    // 1. Firebase status listener
    const statusRef = ref(db, `calls/${roomId}/status`);
    onValue(statusRef, (snap) => {
      const val = snap.val();
      if (val === "active" && statusRefState.current === "ringing") {
        startLiveWebRTC(roomId);
      } else if (val === "declined") {
        setStatus("declined");
        cleanup();
        setTimeout(() => setStatus("idle"), 3500);
      } else if (val === "ended") {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2000);
      }
    }, () => {});

    // 2. Dev server sync polling
    let lastSync = Date.now() - 3000;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/calls?since=${lastSync}`);
        if (res.ok) {
          const events = await res.json();
          if (Array.isArray(events)) {
            lastSync = Date.now();
            for (const ev of events) {
              if (ev.roomId === roomId) {
                if (ev.type === "accepted" && statusRefState.current === "ringing") {
                  startLiveWebRTC(roomId);
                } else if (ev.type === "answer" && pcRef.current && pcRef.current.signalingState === "have-local-offer") {
                  await pcRef.current.setRemoteDescription(new RTCSessionDescription(ev.sdp));
                  setStatus("active");
                } else if (ev.type === "ice-candidate" && ev.role === "psych" && pcRef.current) {
                  pcRef.current.addIceCandidate(new RTCIceCandidate(ev.candidate)).catch(() => {});
                } else if (ev.type === "declined") {
                  setStatus("declined");
                  cleanup();
                  setTimeout(() => setStatus("idle"), 3500);
                } else if (ev.type === "ended") {
                  setStatus("ended");
                  cleanup();
                  setTimeout(() => setStatus("idle"), 2000);
                } else if (ev.type === "chat" && ev.role === "psych") {
                  setMessages(prev => [...prev, { id: Date.now(), role: "psych", text: ev.text, time: ev.time || "now", sender: ev.sender || "Dr. Priya Iyer" }]);
                }
              }
            }
          }
        }
      } catch (_) {}
    }, 600);

    // Timeout if no psychologist answers in 35 seconds
    const timeoutTimer = setTimeout(() => {
      if (statusRefState.current === "ringing") {
        setStatus("no-psych");
        cleanup();
        setTimeout(() => setStatus("idle"), 4000);
      }
    }, 35000);

    // 3. BroadcastChannel listener
    try {
      const bc = new BroadcastChannel("soulsync_calls");
      bc.onmessage = (event) => {
        const ev = event.data;
        if (ev && ev.roomId === roomId) {
          if (ev.type === "accepted" && statusRefState.current === "ringing") {
            startLiveWebRTC(roomId);
          } else if (ev.type === "declined") {
            setStatus("declined");
            cleanup();
            setTimeout(() => setStatus("idle"), 3500);
          } else if (ev.type === "ended") {
            setStatus("ended");
            cleanup();
            setTimeout(() => setStatus("idle"), 2000);
          }
        }
      };
      return () => {
        clearTimeout(timeoutTimer);
        clearInterval(interval);
        off(statusRef);
        bc.close();
      };
    } catch (_) {
      return () => {
        clearTimeout(timeoutTimer);
        clearInterval(interval);
        off(statusRef);
      };
    }
  }, [roomId, peerName, startLiveWebRTC, cleanup]);

  const endCall = useCallback(() => {
    if (roomId) {
      set(ref(db, `calls/${roomId}/status`), "ended").catch(() => {});
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
    }
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, [roomId, cleanup]);

  const sendMessage = useCallback((text: string) => {
    if (!roomId || !text.trim()) return;
    const msg = { role: "user" as const, text: text.trim(), sender: userName, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), id: Date.now() };
    setMessages(p => [...p, msg]);

    const chatRef = ref(db, `calls/${roomId}/chat`);
    push(chatRef, msg).catch(() => {});

    fetch("/api/sync/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat", roomId, ...msg }),
    }).catch(() => {});
  }, [roomId, userName]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    status, roomId, peerName, peerId,
    messages, localStream, remoteStream,
    dial, endCall, sendMessage,
  };
}
