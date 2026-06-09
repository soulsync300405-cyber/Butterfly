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
        const iceRef = ref(db, `calls/${rid}/iceCandidates/psych`);
        push(iceRef, e.candidate.toJSON());
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
    
    // Mark as active
    set(ref(db, `calls/${rid}/status`), "active");
    set(ref(db, `calls/${rid}/psychId`), clientId);

    setPeerId(incoming.userSocketId);
    setPeerName(incoming.userName);
    setRoomId(rid);
    setIncoming(null);

    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = setupPC(incoming.userSocketId, stream, rid);

    // Listen for Offer
    const offerRef = ref(db, `calls/${rid}/offer`);
    onValue(offerRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        // Write Answer
        set(ref(db, `calls/${rid}/answer`), {
          type: answer.type,
          sdp: answer.sdp,
          from: clientId
        });
      }
    });

    // Listen for Remote ICE candidates
    const remoteIceRef = ref(db, `calls/${rid}/iceCandidates/user`);
    onChildAdded(remoteIceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
    });
    
    // Listen for chat
    const chatRef = ref(db, `calls/${rid}/chat`);
    onChildAdded(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMessages(prev => [...prev, data]);
    });

    // Listen for call ended
    const statusRef = ref(db, `calls/${rid}/status`);
    onValue(statusRef, (snapshot) => {
      if (snapshot.val() === "ended") {
        cleanup();
        setStatus("ended");
        setTimeout(() => setStatus("idle"), 2500);
      }
    });

  }, [incoming, setupPC, clientId, cleanup]);

  const decline = useCallback(() => {
    if (!incoming) return;
    set(ref(db, `calls/${incoming.roomId}/status`), "ended");
    setIncoming(null);
    setStatus("idle");
  }, [incoming]);

  const endCall = useCallback(() => {
    if (roomId) set(ref(db, `calls/${roomId}/status`), "ended");
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2500);
  }, [roomId, cleanup]);

  const sendMessage = useCallback((text: string, senderName: string) => {
    if (!roomId || !text.trim()) return;
    const chatRef = ref(db, `calls/${roomId}/chat`);
    push(chatRef, { role: "psych", text: text.trim(), sender: senderName });
  }, [roomId]);

  // Listen for incoming calls globally
  useEffect(() => {
    const callsRef = query(ref(db, 'calls'), orderByChild('status'), equalTo('ringing'));
    const unsubscribe = onChildAdded(callsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.status === "ringing" && status === "idle") {
        setIncoming({
          roomId: snapshot.key as string,
          userSocketId: data.offer?.from || "user",
          userName: "Student" // Can be passed in node
        });
        setStatus("incoming");
      }
    });
    return () => off(ref(db, 'calls'), 'child_added', unsubscribe);
  }, [status]);

  return {
    status, incoming, roomId, peerName, peerId,
    messages, localStream, remoteStream,
    accept, decline, endCall, sendMessage,
  };
}
