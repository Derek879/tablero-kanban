import cors from "cors";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { z, ZodError } from "zod";

import { requiereLogin, rutasAuth } from "./auth.js";
import type { DB } from "./db.js";
import { ErrorHttp } from "./errores.js";
import { Kanban } from "./kanban.js";
import { calcularMetricas } from "./metricas.js";

/** Se llama después de cada cambio para avisar a los clientes conectados al tablero. */
export type Notificar = (tableroId: number) => void;

const id = z.coerce.number().int().positive();
const fecha = z.iso.date().nullable().optional();
const prioridad = z.enum(["baja", "media", "alta"]).optional();

const tarjetaNueva = z.object({
  titulo: z.string().trim().min(1).max(120),
  descripcion: z.string().max(2000).optional(),
  prioridad,
  responsable_id: id.nullable().optional(),
  fecha_limite: fecha,
  columna_id: id.optional(),
});
const tarjetaEdicion = tarjetaNueva.omit({ columna_id: true }).partial();
const movimiento = z.object({ columna_id: id, posicion: z.number().int().min(0) });
const columnaEdicion = z.object({
  nombre: z.string().trim().min(1).max(40).optional(),
  limite_wip: z.number().int().min(1).max(50).nullable().optional(),
});

export function crearApp(db: DB, notificar: Notificar = () => {}, reloj?: () => Date) {
  const kanban = new Kanban(db, reloj);
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/salud", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", rutasAuth(db));

  const api = Router();
  api.use(requiereLogin);
  const usuario = (req: Request) => req.usuario!.id;

  api.get("/tableros", (req, res) => {
    res.json(kanban.tablerosDe(usuario(req)));
  });

  api.post("/tableros", (req, res) => {
    const { nombre } = z.object({ nombre: z.string().trim().min(1).max(80) }).parse(req.body);
    const tableroId = kanban.crearTablero(usuario(req), nombre);
    res.status(201).json(kanban.obtenerTablero(tableroId));
  });

  api.get("/tableros/:id", (req, res) => {
    const tableroId = id.parse(req.params.id);
    kanban.rolEn(tableroId, usuario(req));
    res.json(kanban.obtenerTablero(tableroId));
  });

  api.post("/tableros/:id/miembros", (req, res) => {
    const tableroId = id.parse(req.params.id);
    const { email } = z.object({ email: z.email() }).parse(req.body);
    const miembro = kanban.agregarMiembro(tableroId, usuario(req), email);
    notificar(tableroId);
    res.status(201).json(miembro);
  });

  api.get("/tableros/:id/actividad", (req, res) => {
    const tableroId = id.parse(req.params.id);
    kanban.rolEn(tableroId, usuario(req));
    res.json(kanban.actividad(tableroId));
  });

  api.get("/tableros/:id/metricas", (req, res) => {
    const tableroId = id.parse(req.params.id);
    kanban.rolEn(tableroId, usuario(req));
    res.json(calcularMetricas(db, tableroId, reloj?.()));
  });

  api.patch("/columnas/:id", (req, res) => {
    const tableroId = kanban.actualizarColumna(id.parse(req.params.id), usuario(req), columnaEdicion.parse(req.body));
    notificar(tableroId);
    res.json(kanban.obtenerTablero(tableroId));
  });

  api.post("/tableros/:id/tarjetas", (req, res) => {
    const tableroId = id.parse(req.params.id);
    const tarjeta = kanban.crearTarjeta(tableroId, usuario(req), tarjetaNueva.parse(req.body));
    notificar(tableroId);
    res.status(201).json(tarjeta);
  });

  api.patch("/tarjetas/:id", (req, res) => {
    const tarjeta = kanban.actualizarTarjeta(id.parse(req.params.id), usuario(req), tarjetaEdicion.parse(req.body));
    notificar(tarjeta.tablero_id);
    res.json(tarjeta);
  });

  api.post("/tarjetas/:id/mover", (req, res) => {
    const { columna_id, posicion } = movimiento.parse(req.body);
    const tarjeta = kanban.moverTarjeta(id.parse(req.params.id), usuario(req), columna_id, posicion);
    notificar(tarjeta.tablero_id);
    res.json(tarjeta);
  });

  api.delete("/tarjetas/:id", (req, res) => {
    const tableroId = kanban.eliminarTarjeta(id.parse(req.params.id), usuario(req));
    notificar(tableroId);
    res.status(204).end();
  });

  app.use("/api", api);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Datos inválidos.", detalles: z.flattenError(err).fieldErrors });
    } else if (err instanceof ErrorHttp) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "Error interno." });
    }
  });

  return { app, kanban };
}
