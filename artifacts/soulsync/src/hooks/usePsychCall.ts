import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { LiveMsg } from "./useStudentCall";

export type PsychCallStatus =
  | "idle"
  | "incoming"      // receiving a dial
  | "connecting"    // accepted, setting up WebRTC (psych = responder)
  | "active"        // live call
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

export function usePsychCall(socket: Socket | null) {
  const [status, setStatus]               = useState<PsychCallStatus>("idle");
  const [incoming, setIncoming]           = useState<IncomingCallInfo | null>(null);
  const [roomId, setRoomId]               = useState("");
  const [peerName, setPeerName]           = useState("");
  const [peerId, setPeerId]               = useState("");  // user's socket ID
  const [messages, setMessages]           = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream]     = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteRef      = useRef<MediaStream>(new MediaStream());

  // ── WebRTC setup (psych is always the RESPONDER) ──────────────────────────
  const setupPC = useCallback((userSocketId: string, stream: MediaStream | null) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;

    stream?.getTracks().forEach(t => pc.addTrack(t, stream!));

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteRef.current.addTrack(t));
      setRemoteStream(new MediaStream(remoteRef.current.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("ice-candidate", { to: userSocketId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("active");
    };

    return pc;
  }, [socket]);

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

  // ── Accept / Decline ──────────────────────────────────────────────────────
  const accept = useCallback(async () => {
    if (!socket || !incoming) return;
    setStatus("connecting");

    socket.emit("call-accepted", {
      roomId: incoming.roomId,
      userSocketId: incoming.userSocketId,
    });

    setPeerId(incoming.userSocketId);
    setPeerName(incoming.userName);
    setRoomId(incoming.roomId);
    setIncoming(null);

    const stream = await getStream();
    localStreamRef.current = stream;
    setLocalStream(stream);

    setupPC(incoming.userSocketId, stream);
    // Wait for offer event to arrive — handled in useEffect below
  }, [socket, incoming, setupPC]);

  const decline = useCallback(() => {
    if (!socket || !incoming) return;
    socket.emit("call-declined", { userSocketId: incoming.userSocketId });
    setIncoming(null);
    setStatus("idle");
  }, [socket, incoming]);

  const endCall = useCallback(() => {
    if (socket && roomId) socket.emit("end-call", { roomId });
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2500);
  }, [socket, roomId, cleanup]);

  const sendMessage = useCallback((text: string, senderName: string) => {
    if (!socket || !roomId || !text.trim()) return;
    socket.emit("chat-message", { roomId, text: text.trim(), role: "psych", sender: senderName });
  }, [socket, roomId]);

  // ── Socket event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (info: IncomingCallInfo) => {
      setIncoming(info);
      setStatus("incoming");
    };

    const onSessionStarted = ({ roomId: rid, userName: uName, userSocketId: uId }: {
      roomId: string; userName: string; userSocketId: string;
    }) => {
      setRoomId(rid);
      setPeerName(uName);
      setPeerId(uId);
    };

    // Psych receives OFFER from user → creates answer
    const onOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer });
        setStatus("active");
      } catch (err) {
        console.error("Psych offer handling failed", err);
      }
    };

    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
    };

    const onChatMsg = (msg: LiveMsg) => {
      setMessages(prev => [...prev, msg]);
    };

    const onCallEnded = () => {
      cleanup();
      setStatus("ended");
      setTimeout(() => setStatus("idle"), 2500);
    };

    socket.on("incoming-call", onIncoming);
    socket.on("call-session-started", onSessionStarted);
    socket.on("offer", onOffer);
    socket.on("ice-candidate", onIce);
    socket.on("chat-message", onChatMsg);
    socket.on("call-ended", onCallEnded);

    return () => {
      socket.off("incoming-call", onIncoming);
      socket.off("call-session-started", onSessionStarted);
      socket.off("offer", onOffer);
      socket.off("ice-candidate", onIce);
      socket.off("chat-message", onChatMsg);
      socket.off("call-ended", onCallEnded);
    };
  }, [socket, cleanup]);

  return {
    status, incoming, roomId, peerName, peerId,
    messages, localStream, remoteStream,
    accept, decline, endCall, sendMessage,
  };
}
