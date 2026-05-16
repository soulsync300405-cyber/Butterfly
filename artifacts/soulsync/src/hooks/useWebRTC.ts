import { useRef, useState, useCallback, useEffect } from "react";
import { io, type Socket } from "socket.io-client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export type WebRTCStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export function useWebRTC(roomId: string, localStream: MediaStream | null) {
  const [status, setStatus] = useState<WebRTCStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    localStream?.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStreamRef.current.addTrack(track);
      });
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
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
      const state = pc.connectionState;
      if (state === "connected") setStatus("connected");
      if (state === "disconnected" || state === "failed") setStatus("disconnected");
    };

    return pc;
  }, [localStream]);

  const connect = useCallback(() => {
    if (!localStream) return;
    setStatus("connecting");

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

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: peerId, offer });
      }
    });

    socket.on("user-joined", async (peerId: string) => {
      setRemotePeerId(peerId);
    });

    socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from);
      setRemotePeerId(from);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    });

    socket.on("answer", async ({ answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("ice-candidate", async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
    });

    socket.on("user-left", () => {
      setStatus("disconnected");
      setRemoteStream(null);
    });

    socket.on("call-ended", () => {
      setStatus("disconnected");
      disconnect();
    });
  }, [roomId, localStream, createPeerConnection]);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("end-call", roomId);
      socket.disconnect();
      socketRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = new MediaStream();
    setRemoteStream(null);
    setRemotePeerId(null);
    setStatus("idle");
  }, [roomId]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { status, remoteStream, remotePeerId, connect, disconnect };
}
