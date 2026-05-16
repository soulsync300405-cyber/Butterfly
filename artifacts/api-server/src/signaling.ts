import type { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

interface Room {
  users: string[];
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

export function setupSignaling(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-room", (roomId: string) => {
      logger.info({ socketId: socket.id, roomId }, "join-room");

      let room = rooms.get(roomId);
      if (!room) {
        room = { users: [] };
        rooms.set(roomId, room);
      }

      room.users.push(socket.id);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);

      const others = room.users.filter(id => id !== socket.id);
      socket.emit("room-users", others);
      socket.to(roomId).emit("user-joined", socket.id);

      logger.info({ roomId, count: room.users.length }, "Room updated");
    });

    socket.on("offer", (payload: { to: string; offer: unknown }) => {
      logger.info({ from: socket.id, to: payload.to }, "offer relayed");
      io.to(payload.to).emit("offer", { from: socket.id, offer: payload.offer });
    });

    socket.on("answer", (payload: { to: string; answer: unknown }) => {
      logger.info({ from: socket.id, to: payload.to }, "answer relayed");
      io.to(payload.to).emit("answer", { from: socket.id, answer: payload.answer });
    });

    socket.on("ice-candidate", (payload: { to: string; candidate: unknown }) => {
      io.to(payload.to).emit("ice-candidate", { from: socket.id, candidate: payload.candidate });
    });

    socket.on("end-call", (roomId: string) => {
      logger.info({ socketId: socket.id, roomId }, "end-call");
      socket.to(roomId).emit("call-ended");
      cleanupSocket(socket.id, io);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socket.to(roomId).emit("user-left", socket.id);
      }
      cleanupSocket(socket.id, io);
    });
  });
}

function cleanupSocket(socketId: string, _io: Server) {
  const roomId = socketToRoom.get(socketId);
  if (roomId) {
    const room = rooms.get(roomId);
    if (room) {
      room.users = room.users.filter(id => id !== socketId);
      if (room.users.length === 0) {
        rooms.delete(roomId);
        logger.info({ roomId }, "Room destroyed");
      }
    }
    socketToRoom.delete(socketId);
  }
}
