import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { io as conectar } from "socket.io-client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { crearApp } from "../src/app.js";
import { crearBaseDeDatos } from "../src/db.js";
import { crearTiempoReal } from "../src/tiempo-real.js";

describe("tiempo real", () => {
  const db = crearBaseDeDatos(":memory:");
  let notificar = (_id: number) => {};
  const { app, kanban } = crearApp(db, (id) => notificar(id));
  const http = createServer(app);
  const tr = crearTiempoReal(http, kanban);
  notificar = tr.notificar;
  afterAll(() => {
    tr.io.close();
  });

  it("envía el tablero actualizado a quien lo tiene abierto", async () => {
    await new Promise<void>((ok) => http.listen(0, ok));
    const url = `http://localhost:${(http.address() as AddressInfo).port}`;
    const registro = await request(app).post("/api/auth/registro").send({ nombre: "Ana", email: "ana@correo.com", clave: "clave-segura" });
    const token = registro.body.token;
    const tablero = await request(app).post("/api/tableros").set("Authorization", `Bearer ${token}`).send({ nombre: "Sprint" });

    const cliente = conectar(url, { auth: { token }, transports: ["websocket"] });
    const unido = await cliente.emitWithAck("tablero:unirse", tablero.body.id);
    expect(unido.ok).toBe(true);

    const recibido = new Promise<{ columnas: { tarjetas: { titulo: string }[] }[] }>((ok) =>
      cliente.once("tablero:actualizado", ok),
    );
    await request(app).post(`/api/tableros/${tablero.body.id}/tarjetas`).set("Authorization", `Bearer ${token}`).send({ titulo: "Login" });
    expect((await recibido).columnas[0].tarjetas[0].titulo).toBe("Login");
    cliente.close();
  });

  it("rechaza conexiones sin token", async () => {
    const url = `http://localhost:${(http.address() as AddressInfo).port}`;
    const cliente = conectar(url, { auth: { token: "falso" }, transports: ["websocket"] });
    const error = await new Promise<Error>((ok) => cliente.once("connect_error", ok));
    expect(error.message).toBe("No autorizado");
    cliente.close();
  });
});
