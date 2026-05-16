import { useRef, useState, useCallback, useEffect } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type WebRTCStatus = "idle" | "connecting" | "connected" | "disconnected" | "error" | "unavailable";

const hasWebRTC = typeof window !== "undefined" &&
  "RTCPeerConnection" in window &&
  "MediaStream" in window;

export function useWebRTC(roomId: string, localStream: MediaStream | null) {
  const [status, setStatus] = useState<WebRTCStatus>(hasWebRTC ? "idle" : "unavailable");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);

  const socketRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((peerId: string) => {
    if (!hasWebRTC) return null;
    try {
      remoteStreamRef.current = new MediaStream();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      localStream?.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach(track => {
          remoteStreamRef.current?.addTrack(track);
        });
        if (remoteStreamRef.current) {
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        }
        setStatus("connected");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            to: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") setStatus("disconnected");
      };

      return pc;
    } catch {
      setStatus("error");
      return null;
    }
  }, [localStream]);

  const connect = useCallback(async () => {
    if (!hasWebRTC) { setStatus("unavailable"); return; }

    setStatus("connecting");

    // Dynamically import socket.io-client to avoid load-time crash
    let io: any;
    try {
      const mod = await import("socket.io-client");
      io = mod.io;
    } catch {
      setStatus("error");
      return;
    }

    try {
      const socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join-room", roomId);
      });

      socket.on("connect_error", () => {
        setStatus("error");
      });

      socket.on("room-users", async (users: string[]) => {
        if (users.length > 0) {
          const peerId = users[0];
          setRemotePeerId(peerId);
          const pc = createPeerConnection(peerId);
          if (!pc) return;

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { to: peerId, offer });
          } catch { setStatus("error"); }
        }
      });

      socket.on("user-joined", (peerId: string) => {
        setRemotePeerId(peerId);
      });

      socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(from);
        if (!pc) return;
        setRemotePeerId(from);

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", { to: from, answer });
        } catch { setStatus("error"); }
      });

      socket.on("answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        try {
          if (pcRef.current?.signalingState === "have-local-offer") {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch { }
      });

      socket.on("ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch { }
      });

      socket.on("user-left", () => { setStatus("disconnected"); setRemoteStream(null); });
      socket.on("call-ended", () => { setStatus("disconnected"); disconnect(); });

    } catch {
      setStatus("error");
    }
  }, [roomId, createPeerConnection]);

  const disconnect = useCallback(() => {
    try {
      if (socketRef.current) {
        socketRef.current.emit("end-call", roomId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pcRef.current?.close();
      pcRef.current = null;
      remoteStreamRef.current = null;
      setRemoteStream(null);
      setRemotePeerId(null);
      setStatus("idle");
    } catch { }
  }, [roomId]);

  useEffect(() => {
    return () => { try { disconnect(); } catch { } };
  }, [disconnect]);

  return { status, remoteStream, remotePeerId, connect, disconnect, hasWebRTC };
}
