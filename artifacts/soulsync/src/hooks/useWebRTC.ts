import { useRef, useState, useCallback, useEffect } from "react";
import { ref, set, onValue, off, push, onChildAdded, remove, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useClientId } from "@/hooks/useDbSync";

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const clientId = useClientId() || "user_" + Math.random().toString(36).substring(7);

  const createPeerConnection = useCallback(() => {
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
        if (event.candidate) {
          const iceRef = ref(db, `calls/${roomId}/iceCandidates/user`);
          push(iceRef, event.candidate.toJSON());
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
  }, [localStream, roomId]);

  const connect = useCallback(async () => {
    if (!hasWebRTC) { setStatus("unavailable"); return; }
    setStatus("connecting");

    const pc = createPeerConnection();
    if (!pc) return;

    try {
      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      const callRef = ref(db, `calls/${roomId}`);
      await set(callRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
          from: clientId
        },
        status: "ringing"
      });

      // Listen for Answer
      const answerRef = ref(db, `calls/${roomId}/answer`);
      onValue(answerRef, (snapshot) => {
        const data = snapshot.val();
        if (data && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data))
            .catch(() => setStatus("error"));
          setRemotePeerId(data.from || "psychologist");
        }
      });

      // Listen for Remote ICE candidates
      const remoteIceRef = ref(db, `calls/${roomId}/iceCandidates/psych`);
      onChildAdded(remoteIceRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
        }
      });

      // Listen for Call End
      const statusRef = ref(db, `calls/${roomId}/status`);
      onValue(statusRef, (snapshot) => {
        if (snapshot.val() === "ended") {
          setStatus("disconnected");
          disconnect();
        }
      });

    } catch (err) {
      setStatus("error");
    }
  }, [roomId, createPeerConnection, clientId]);

  const disconnect = useCallback(() => {
    try {
      const statusRef = ref(db, `calls/${roomId}/status`);
      set(statusRef, "ended");
      
      // Cleanup Firebase listeners
      off(ref(db, `calls/${roomId}/answer`));
      off(ref(db, `calls/${roomId}/iceCandidates/psych`));
      off(ref(db, `calls/${roomId}/status`));

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
