import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

// Module-level singleton so re-renders never recreate the socket
let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
  }
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/** Call at the top of StudentApp / PsychDashboard to register role with the server. */
export function useRegisterSocket(role: "user" | "psychologist", name: string) {
  useEffect(() => {
    const socket = getSocket();

    const register = () => {
      socket.emit("register", { role, name });
    };

    if (socket.connected) {
      register();
    } else {
      socket.once("connect", register);
    }

    // Re-register on reconnect
    socket.on("connect", register);

    return () => {
      socket.off("connect", register);
    };
  }, [role, name]);

  return getSocket();
}
