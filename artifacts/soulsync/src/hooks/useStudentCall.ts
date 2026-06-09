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
  
  const clientId       = useClientId() || "user_" + Math.random().toString(36).substring(7);

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
        const iceRef = ref(db, `calls/${rid}/iceCandidates/user`);
        push(iceRef, e.candidate.toJSON());
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

  const dial = useCallback(async (psychName?: string) => {
    if (status !== "idle") return;
    setStatus("ringing");

    // Create a new room ID
    const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setRoomId(newRoomId);
    setPeerName(psychName || "Psychologist");

    const callRef = ref(db, `calls/${newRoomId}`);
    
    // We haven't created the offer yet, just signaling ringing
    await set(callRef, {
      status: "ringing",
      offer: { from: clientId } // Just to let psych know who is calling
    });

    // Listen to status changes
    const statusRef = ref(db, `calls/${newRoomId}/status`);
    onValue(statusRef, async (snapshot) => {
      const currentStatus = snapshot.val();
      
      if (currentStatus === "declined") {
        setStatus("declined");
        cleanup();
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }
      
      if (currentStatus === "ended") {
        setStatus("ended");
        cleanup();
        setTimeout(() => setStatus("idle"), 2500);
        return;
      }

      if (currentStatus === "active" && !pcRef.current) {
        setStatus("connecting");

        // Fetch psychId
        const psychIdSnapshot = await get(ref(db, `calls/${newRoomId}/psychId`));
        const pId = psychIdSnapshot.val();
        setPeerId(pId || "psychologist");

        const stream = await getStream();
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = setupPC(stream, newRoomId);

        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        await set(ref(db, `calls/${newRoomId}/offer`), {
          type: offer.type,
          sdp: offer.sdp,
          from: clientId
        });

        // Listen for Answer
        const answerRef = ref(db, `calls/${newRoomId}/answer`);
        onValue(answerRef, async (ansSnapshot) => {
          const ansData = ansSnapshot.val();
          if (ansData && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(ansData));
            setStatus("active");
          }
        });

        // Listen for remote ICE candidates
        const remoteIceRef = ref(db, `calls/${newRoomId}/iceCandidates/psych`);
        onChildAdded(remoteIceRef, (iceSnapshot) => {
          const iceData = iceSnapshot.val();
          if (iceData) pc.addIceCandidate(new RTCIceCandidate(iceData)).catch(() => {});
        });

        // Listen for chat
        const chatRef = ref(db, `calls/${newRoomId}/chat`);
        onChildAdded(chatRef, (chatSnapshot) => {
          const msgData = chatSnapshot.val();
          if (msgData) setMessages(prev => [...prev, msgData]);
        });
      }
    });

    // Timeout if no one picks up in 30 seconds
    setTimeout(async () => {
      const currentSnap = await get(statusRef);
      if (currentSnap.val() === "ringing") {
        await set(statusRef, "no-psych");
        setStatus("no-psych");
        cleanup();
        setTimeout(() => setStatus("idle"), 4000);
      }
    }, 30000);

  }, [status, clientId, setupPC, cleanup]);

  const endCall = useCallback(() => {
    if (roomId) set(ref(db, `calls/${roomId}/status`), "ended");
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, [roomId, cleanup]);

  const sendMessage = useCallback((text: string) => {
    if (!roomId || !text.trim()) return;
    const chatRef = ref(db, `calls/${roomId}/chat`);
    push(chatRef, { role: "user", text: text.trim(), sender: userName });
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
