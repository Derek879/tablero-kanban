import request from "supertest";

import { crearApp } from "../src/app.js";
import { crearBaseDeDatos } from "../src/db.js";

export function entorno(reloj?: () => Date) {
  const db = crearBaseDeDatos(":memory:");
  const notificados: number[] = [];
  const { app } = crearApp(db, (id) => notificados.push(id), reloj);
  const api = request(app);

  async function registrar(nombre: string, email: string) {
    const r = await api.post("/api/auth/registro").send({ nombre, email, clave: "clave-segura" });
    return { id: r.body.usuario.id as number, auth: { Authorization: `Bearer ${r.body.token}` } };
  }

  async function tablero(auth: Record<string, string>) {
    const r = await api.post("/api/tableros").set(auth).send({ nombre: "Sprint 1" });
    const [porHacer, enProgreso, enRevision, hecho] = r.body.columnas.map((c: { id: number }) => c.id);
    return { id: r.body.id as number, porHacer, enProgreso, enRevision, hecho };
  }

  return { api, db, notificados, registrar, tablero };
}
