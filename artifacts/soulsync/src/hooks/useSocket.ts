import { useEffect, useState, useRef } from "react";
import { io, type Socket } from "socket.io-client";

// Module-level singleton
let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    _socket = io(backendUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
  }
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/** Register this client as user/psychologist with the signaling server. */
export function useRegisterSocket(role: "user" | "psychologist", name: string): Socket | null {
  const [connected, setConnected] = useState(false);
  const registeredRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      if (!registeredRef.current || true) { // always re-register on reconnect
        socket.emit("register", { role, name });
        registeredRef.current = true;
        console.log(`[SoulSync] Socket connected & registered as ${role}: "${name}"`);
      }
    };

    const onDisconnect = (reason: string) => {
      setConnected(false);
      registeredRef.current = false;
      console.log(`[SoulSync] Socket disconnected: ${reason}`);
    };

    const onConnectError = (err: Error) => {
      console.warn(`[SoulSync] Socket connect error: ${err.message} — is the signaling server running on port 3001?`);
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [role, name]);

  return connected ? getSocket() : null;
}

