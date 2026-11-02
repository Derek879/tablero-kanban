import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import express from "express";

import { crearApp } from "./app.js";
import { crearBaseDeDatos } from "./db.js";
import { crearTiempoReal } from "./tiempo-real.js";

const puerto = Number(process.env.PORT ?? 3000);
const db = crearBaseDeDatos();

// El servidor HTTP se crea primero porque Socket.IO se monta sobre él.
let notificar = (_tableroId: number) => {};
const { app, kanban } = crearApp(db, (tableroId) => notificar(tableroId));
const http = createServer(app);
notificar = crearTiempoReal(http, kanban).notificar;

// En producción el mismo servidor entrega el frontend ya compilado.
const cliente = process.env.CLIENT_DIST ?? path.resolve("../client/dist");
if (existsSync(cliente)) {
  app.use(express.static(cliente));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(cliente, "index.html")));
}

http.listen(puerto, () => console.log(`Servidor del tablero en http://localhost:${puerto}`));
