import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { verificarToken } from "./auth.js";
import type { Kanban } from "./kanban.js";

/**
 * Cada tablero es una "sala" de Socket.IO. Cuando alguien cambia algo, el servidor envía
 * el tablero actualizado a todos los que lo tienen abierto, así nadie trabaja con datos viejos.
 */
export function crearTiempoReal(http: HttpServer, kanban: Kanban) {
  const io = new Server(http, { cors: { origin: "*" } });

  io.use((socket, next) => {
    try {
      socket.data.usuario = verificarToken(String(socket.handshake.auth.token ?? ""));
      next();
    } catch {
      next(new Error("No autorizado"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("tablero:unirse", (tableroId: number, responder?: (r: { ok: boolean; error?: string }) => void) => {
      try {
        kanban.rolEn(Number(tableroId), socket.data.usuario.id);
        for (const sala of socket.rooms) if (sala.startsWith("tablero:")) socket.leave(sala);
        socket.join(`tablero:${tableroId}`);
        responder?.({ ok: true });
      } catch (e) {
        responder?.({ ok: false, error: (e as Error).message });
      }
    });
  });

  return {
    io,
    notificar(tableroId: number) {
      io.to(`tablero:${tableroId}`).emit("tablero:actualizado", kanban.obtenerTablero(tableroId));
    },
  };
}
