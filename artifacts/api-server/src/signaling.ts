import type { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Peer {
  socketId: string;
  name: string;
  role: "user" | "psychologist";
  available: boolean;
}

interface LiveMsg {
  id: number;
  role: "user" | "psych";
  text: string;
  time: string;
  sender: string;
}

interface ActiveCall {
  roomId: string;
  userSocketId: string;
  psychSocketId: string;
  history: LiveMsg[];
}

// ── State ─────────────────────────────────────────────────────────────────────

const registry  = new Map<string, Peer>();        // socketId → Peer
const psychPool = new Map<string, Peer>();         // socketId → Peer (online psychologists)
const calls     = new Map<string, ActiveCall>();   // roomId → call
const peerRoom  = new Map<string, string>();       // socketId → roomId

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function terminateCall(roomId: string, io: Server) {
  const call = calls.get(roomId);
  if (!call) return;

  io.to(roomId).emit("call-ended", { roomId });
  logger.info({ roomId }, "call-ended broadcast");

  const psychPeer = registry.get(call.psychSocketId);
  if (psychPeer) {
    psychPeer.available = true;
    psychPool.set(call.psychSocketId, psychPeer);
  }

  peerRoom.delete(call.userSocketId);
  peerRoom.delete(call.psychSocketId);
  calls.delete(roomId);
  logger.info({ roomId }, "Call terminated, psych returned to pool");
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function setupSignaling(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // ─ register ──────────────────────────────────────────────────────────────
    socket.on("register", ({ role, name }: { role: "user" | "psychologist"; name: string }) => {
      const peer: Peer = { socketId: socket.id, name, role, available: true };
      registry.set(socket.id, peer);

      if (role === "psychologist") {
        socket.join("psychologist_pool");
        psychPool.set(socket.id, peer);
        logger.info({ name, socketId: socket.id }, "Psychologist registered in pool");
      }

      socket.emit("registered", { socketId: socket.id });
      logger.info({ role, name, socketId: socket.id }, "Peer registered");
    });

    // ─ dial-psychologist (User → Backend → Psych) ────────────────────────────
    socket.on("dial-psychologist", ({ userName, psychName }: { userName: string; psychName?: string }) => {
      logger.info({ userName, psychName }, "dial-psychologist received");

      let target: Peer | undefined;

      // Try to find specific psych by name first
      if (psychName) {
        for (const [, p] of psychPool) {
          if (p.available && p.name.toLowerCase().includes(psychName.toLowerCase().replace("dr. ", ""))) {
            target = p;
            break;
          }
        }
      }

      // Fall back to any available psych
      if (!target) {
        for (const [, p] of psychPool) {
          if (p.available) { target = p; break; }
        }
      }

      if (!target) {
        socket.emit("no-psych-available");
        logger.info({ userName }, "No psychologist available");
        return;
      }

      const roomId = `call-${socket.id.slice(0, 6)}-${target.socketId.slice(0, 6)}-${Date.now()}`;

      // Mark psych busy
      target.available = false;
      psychPool.set(target.socketId, target);

      // Alert psych
      io.to(target.socketId).emit("incoming-call", {
        roomId,
        userSocketId: socket.id,
        userName,
      });

      // Confirm ring to user
      socket.emit("call-ringing", { roomId, psychName: target.name, psychSocketId: target.socketId });
      logger.info({ roomId, psych: target.name }, "Call ringing");
    });

    // ─ call-accepted (Psych → Backend → User) ────────────────────────────────
    socket.on("call-accepted", ({ roomId, userSocketId }: { roomId: string; userSocketId: string }) => {
      logger.info({ roomId, psychId: socket.id }, "call-accepted");

      const call: ActiveCall = {
        roomId,
        userSocketId,
        psychSocketId: socket.id,
        history: [],
      };
      calls.set(roomId, call);
      peerRoom.set(socket.id, roomId);
      peerRoom.set(userSocketId, roomId);

      socket.join(roomId);
      io.sockets.sockets.get(userSocketId)?.join(roomId);

      const psychPeer = registry.get(socket.id);
      const userPeer  = registry.get(userSocketId);

      // Tell user the call is live (they are the WebRTC initiator)
      io.to(userSocketId).emit("call-accepted", {
        roomId,
        psychName: psychPeer?.name ?? "Psychologist",
        psychSocketId: socket.id,
      });

      // Tell psych session has started (they are the responder)
      socket.emit("call-session-started", {
        roomId,
        userName: userPeer?.name ?? "User",
        userSocketId,
      });

      logger.info({ roomId }, "Call session active");
    });

    // ─ call-declined (Psych → Backend → User) ────────────────────────────────
    socket.on("call-declined", ({ userSocketId }: { userSocketId: string }) => {
      logger.info({ psychId: socket.id, userSocketId }, "call-declined");

      const peer = registry.get(socket.id);
      if (peer) {
        peer.available = true;
        psychPool.set(socket.id, peer);
      }

      io.to(userSocketId).emit("call-declined");
    });

    // ─ WebRTC relay ──────────────────────────────────────────────────────────
    socket.on("offer", ({ to, offer }: { to: string; offer: unknown }) => {
      io.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("answer", ({ to, answer }: { to: string; answer: unknown }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }: { to: string; candidate: unknown }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    // ─ Real-time chat relay ───────────────────────────────────────────────────
    socket.on("chat-message", ({
      roomId, text, role, sender,
    }: { roomId: string; text: string; role: "user" | "psych"; sender: string }) => {
      const call = calls.get(roomId);
      if (!call) return;

      const msg: LiveMsg = {
        id: Date.now(),
        role,
        text,
        time: now(),
        sender,
      };
      call.history.push(msg);

      io.to(roomId).emit("chat-message", msg);
      logger.info({ roomId, role, sender }, "Chat message relayed");
    });

    // ─ Direct message relay (outside of call) ────────────────────────────────
    socket.on("dm-send", ({
      toName, text, fromName, fromRole,
    }: { toName: string; text: string; fromName: string; fromRole: "user" | "psych" }) => {
      const target = [...registry.values()].find(
        p => p.name.toLowerCase() === toName.toLowerCase()
      );
      const msg = { id: Date.now(), fromName, fromRole, text, time: now() };
      if (target) {
        io.to(target.socketId).emit("dm-receive", msg);
      }
      // Echo back to sender so their own UI updates immediately
      socket.emit("dm-receive", msg);
      logger.info({ fromName, toName }, "DM relayed");
    });

    // ─ end-call ──────────────────────────────────────────────────────────────
    socket.on("end-call", ({ roomId }: { roomId: string }) => {
      logger.info({ socketId: socket.id, roomId }, "end-call");
      terminateCall(roomId, io);
    });

    // ─ disconnect ─────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");

      const roomId = peerRoom.get(socket.id);
      if (roomId) terminateCall(roomId, io);

      registry.delete(socket.id);
      psychPool.delete(socket.id);
      peerRoom.delete(socket.id);
    });
  });
}

// ── Presence helpers (used by REST routes) ────────────────────────────────────
export function getOnlineUsers() {
  return [...registry.values()].filter(p => p.role === "user").map(p => ({ name: p.name, role: p.role }));
}

export function getOnlinePsychs() {
  return [...registry.values()].filter(p => p.role === "psychologist").map(p => ({ name: p.name, available: p.available }));
}
