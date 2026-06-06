// Standalone WebRTC Signaling Server for SoulSync
// Run with: node signaling-server.mjs
// Uses zero build steps — pure Node.js + socket.io

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3001;

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const io = new Server(httpServer, {
  path: "/api/socket.io",
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// ── In-memory state ──────────────────────────────────────────────────────────
const registry  = new Map(); // socketId → { socketId, name, role, available }
const psychPool = new Map(); // socketId → peer  (online psychologists)
const calls     = new Map(); // roomId → { roomId, userSocketId, psychSocketId }
const peerRoom  = new Map(); // socketId → roomId

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function terminateCall(roomId) {
  const call = calls.get(roomId);
  if (!call) return;

  io.to(roomId).emit("call-ended", { roomId });

  const psychPeer = registry.get(call.psychSocketId);
  if (psychPeer) {
    psychPeer.available = true;
    psychPool.set(call.psychSocketId, psychPeer);
  }

  peerRoom.delete(call.userSocketId);
  peerRoom.delete(call.psychSocketId);
  calls.delete(roomId);
  console.log(`[${now()}] Call terminated:`, roomId);
}

// ── Connection handler ───────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[${now()}] Connected: ${socket.id}`);

  // ── register ──────────────────────────────────────────────────────────────
  socket.on("register", ({ role, name }) => {
    const peer = { socketId: socket.id, name, role, available: true };
    registry.set(socket.id, peer);

    if (role === "psychologist") {
      socket.join("psychologist_pool");
      psychPool.set(socket.id, peer);
      console.log(`[${now()}] Psychologist registered: ${name} (${socket.id})`);
    }

    socket.emit("registered", { socketId: socket.id });
    console.log(`[${now()}] Registered: ${role} "${name}" (${socket.id})`);
  });

  // ── dial-psychologist ─────────────────────────────────────────────────────
  socket.on("dial-psychologist", ({ userName, psychName }) => {
    console.log(`[${now()}] Dial from "${userName}" → "${psychName || "any"}"`);

    let target;

    // Try specific psych by name
    if (psychName) {
      for (const [, p] of psychPool) {
        if (p.available && p.name.toLowerCase().includes(psychName.toLowerCase().replace("dr. ", ""))) {
          target = p; break;
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
      console.log(`[${now()}] No psychologist available for ${userName}`);
      return;
    }

    const roomId = `call-${socket.id.slice(0, 6)}-${target.socketId.slice(0, 6)}-${Date.now()}`;
    target.available = false;
    psychPool.set(target.socketId, target);

    // Alert the psychologist dashboard
    io.to(target.socketId).emit("incoming-call", {
      roomId,
      userSocketId: socket.id,
      userName,
    });

    // Confirm ring to user
    socket.emit("call-ringing", { roomId, psychName: target.name, psychSocketId: target.socketId });
    console.log(`[${now()}] Ringing: room=${roomId}, psych="${target.name}"`);
  });

  // ── call-accepted (Psych → User) ──────────────────────────────────────────
  socket.on("call-accepted", ({ roomId, userSocketId }) => {
    const call = { roomId, userSocketId, psychSocketId: socket.id };
    calls.set(roomId, call);
    peerRoom.set(socket.id, roomId);
    peerRoom.set(userSocketId, roomId);

    socket.join(roomId);
    io.sockets.sockets.get(userSocketId)?.join(roomId);

    const psychPeer = registry.get(socket.id);
    const userPeer  = registry.get(userSocketId);

    io.to(userSocketId).emit("call-accepted", {
      roomId,
      psychName: psychPeer?.name ?? "Psychologist",
      psychSocketId: socket.id,
    });

    socket.emit("call-session-started", {
      roomId,
      userName: userPeer?.name ?? "User",
      userSocketId,
    });

    console.log(`[${now()}] Call accepted: room=${roomId}`);
  });

  // ── call-declined ─────────────────────────────────────────────────────────
  socket.on("call-declined", ({ userSocketId }) => {
    const peer = registry.get(socket.id);
    if (peer) { peer.available = true; psychPool.set(socket.id, peer); }
    io.to(userSocketId).emit("call-declined");
    console.log(`[${now()}] Call declined by psych ${socket.id}`);
  });

  // ── WebRTC relay ──────────────────────────────────────────────────────────
  socket.on("offer",        ({ to, offer })     => io.to(to).emit("offer",        { from: socket.id, offer }));
  socket.on("answer",       ({ to, answer })    => io.to(to).emit("answer",       { from: socket.id, answer }));
  socket.on("ice-candidate",({ to, candidate }) => io.to(to).emit("ice-candidate",{ from: socket.id, candidate }));

  // ── chat relay ────────────────────────────────────────────────────────────
  socket.on("chat-message", ({ roomId, text, role, sender }) => {
    const call = calls.get(roomId);
    if (!call) return;
    const msg = { id: Date.now(), role, text, time: now(), sender };
    io.to(roomId).emit("chat-message", msg);
  });

  // ── DM relay ─────────────────────────────────────────────────────────────
  socket.on("dm-send", ({ toName, text, fromName, fromRole }) => {
    const target = [...registry.values()].find(p => p.name.toLowerCase() === toName.toLowerCase());
    const msg = { id: Date.now(), fromName, fromRole, text, time: now() };
    if (target) io.to(target.socketId).emit("dm-receive", msg);
    socket.emit("dm-receive", msg);
  });

  // ── end-call ──────────────────────────────────────────────────────────────
  socket.on("end-call", ({ roomId }) => terminateCall(roomId));

  // ── disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[${now()}] Disconnected: ${socket.id}`);
    const roomId = peerRoom.get(socket.id);
    if (roomId) terminateCall(roomId);
    registry.delete(socket.id);
    psychPool.delete(socket.id);
    peerRoom.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n✅ SoulSync Signaling Server running on port ${PORT}`);
  console.log(`   Socket.IO path: /api/socket.io`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
  console.log("Waiting for connections...\n");
});
