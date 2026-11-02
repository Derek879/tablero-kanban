import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import type { DB } from "./db.js";
import { ErrorHttp } from "./errores.js";

const SECRETO = process.env.JWT_SECRET ?? "solo-para-desarrollo";

export interface UsuarioToken {
  id: number;
  nombre: string;
}

declare module "express-serve-static-core" {
  interface Request {
    usuario?: UsuarioToken;
  }
}

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  email: z.email().toLowerCase(),
  clave: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
});

const loginSchema = z.object({ email: z.email().toLowerCase(), clave: z.string() });

export function firmarToken(usuario: UsuarioToken): string {
  return jwt.sign(usuario, SECRETO, { expiresIn: "8h" });
}

export function verificarToken(token: string): UsuarioToken {
  const { id, nombre } = jwt.verify(token, SECRETO) as UsuarioToken;
  return { id, nombre };
}

export function requiereLogin(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return next(new ErrorHttp(401, "Inicia sesión."));
  try {
    req.usuario = verificarToken(token);
    next();
  } catch {
    next(new ErrorHttp(401, "Sesión expirada o inválida."));
  }
}

export function rutasAuth(db: DB): Router {
  const router = Router();

  router.post("/registro", (req, res) => {
    const datos = registroSchema.parse(req.body);
    const existe = db.prepare("SELECT 1 FROM usuarios WHERE email = ?").get(datos.email);
    if (existe) throw new ErrorHttp(409, "Ya existe una cuenta con ese correo.");
    const hash = bcrypt.hashSync(datos.clave, 10);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO usuarios (nombre, email, clave_hash) VALUES (?, ?, ?)")
      .run(datos.nombre, datos.email, hash);
    const usuario = { id: Number(lastInsertRowid), nombre: datos.nombre };
    res.status(201).json({ usuario, token: firmarToken(usuario) });
  });

  router.post("/login", (req, res) => {
    const datos = loginSchema.parse(req.body);
    const fila = db
      .prepare("SELECT id, nombre, clave_hash FROM usuarios WHERE email = ?")
      .get(datos.email) as { id: number; nombre: string; clave_hash: string } | undefined;
    // Mismo mensaje si el correo no existe o la clave está mal, para no revelar qué cuentas existen.
    if (!fila || !bcrypt.compareSync(datos.clave, fila.clave_hash)) {
      throw new ErrorHttp(401, "Correo o clave incorrectos.");
    }
    const usuario = { id: fila.id, nombre: fila.nombre };
    res.json({ usuario, token: firmarToken(usuario) });
  });

  return router;
}
