import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";

export type StudentCallStatus =
  | "idle"
  | "ringing"       // waiting for psych to pick up
  | "no-psych"      // no psych available
  | "declined"      // psych declined
  | "connecting"    // call accepted, setting up WebRTC
  | "active"        // live call
  | "ended";        // call ended

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

export function useStudentCall(socket: Socket | null, userName: string) {
  const [status, setStatus]           = useState<StudentCallStatus>("idle");
  const [roomId, setRoomId]           = useState("");
  const [peerName, setPeerName]       = useState("");
  const [peerId, setPeerId]           = useState("");  // psychologist's socket ID
  const [messages, setMessages]       = useState<LiveMsg[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteRef      = useRef<MediaStream>(new MediaStream());

  // ── WebRTC setup (student is always the INITIATOR) ────────────────────────
  const setupPC = useCallback((psychSocketId: string, stream: MediaStream | null) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;

    stream?.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteRef.current.addTrack(t));
      setRemoteStream(new MediaStream(remoteRef.current.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("ice-candidate", { to: psychSocketId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("active");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") cleanup();
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
  }, []);

  // ── Dial ─────────────────────────────────────────────────────────────────
  const dial = useCallback((psychName?: string) => {
    if (!socket || status !== "idle") return;
    setStatus("ringing");
    socket.emit("dial-psychologist", { userName, psychName });
  }, [socket, status, userName]);

  const endCall = useCallback(() => {
    if (socket && roomId) socket.emit("end-call", { roomId });
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, [socket, roomId, cleanup]);

  const sendMessage = useCallback((text: string) => {
    if (!socket || !roomId || !text.trim()) return;
    socket.emit("chat-message", { roomId, text: text.trim(), role: "user", sender: userName });
  }, [socket, roomId, userName]);

  // ── Socket event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRinging = ({ roomId: rid, psychName: pName }: { roomId: string; psychName: string; psychSocketId: string }) => {
      setRoomId(rid);
      setPeerName(pName);
    };

    const onAccepted = async ({
      roomId: rid, psychName: pName, psychSocketId: pId,
    }: { roomId: string; psychName: string; psychSocketId: string }) => {
      setRoomId(rid);
      setPeerName(pName);
      setPeerId(pId);
      setStatus("connecting");

      const stream = await getStream();
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPC(pId, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: pId, offer });
    };

    const onDeclined = () => {
      setStatus("declined");
      cleanup();
      setTimeout(() => setStatus("idle"), 3000);
    };

    const onNoPsych = () => {
      setStatus("no-psych");
      setTimeout(() => setStatus("idle"), 4000);
    };

    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current?.signalingState === "have-local-offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus("active");
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

    socket.on("call-ringing", onRinging);
    socket.on("call-accepted", onAccepted);
    socket.on("call-declined", onDeclined);
    socket.on("no-psych-available", onNoPsych);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("chat-message", onChatMsg);
    socket.on("call-ended", onCallEnded);

    return () => {
      socket.off("call-ringing", onRinging);
      socket.off("call-accepted", onAccepted);
      socket.off("call-declined", onDeclined);
      socket.off("no-psych-available", onNoPsych);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("chat-message", onChatMsg);
      socket.off("call-ended", onCallEnded);
    };
  }, [socket, cleanup, setupPC]);

  return {
    status, roomId, peerName, peerId,
    messages, localStream, remoteStream,
    dial, endCall, sendMessage,
  };
}
