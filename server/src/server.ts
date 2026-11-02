import { createServer } from "node:http";

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

http.listen(puerto, () => console.log(`Servidor del tablero en http://localhost:${puerto}`));
