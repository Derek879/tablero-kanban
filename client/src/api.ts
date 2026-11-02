import type { Actividad, Metricas, ResumenTablero, Tablero, Tarjeta, Usuario } from "./tipos";

const CLAVE = "kanban.sesion";

export interface Sesion {
  token: string;
  usuario: Usuario;
}

export function sesionGuardada(): Sesion | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "null");
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: Sesion | null) {
  if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
  else localStorage.removeItem(CLAVE);
}

export class ErrorApi extends Error {
  status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const sesion = sesionGuardada();
  const r = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(sesion ? { Authorization: `Bearer ${sesion.token}` } : {}),
    },
  });
  if (r.status === 204) return undefined as T;
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && sesion) {
      guardarSesion(null);
      location.reload();
    }
    throw new ErrorApi(r.status, cuerpo.error ?? "Ocurrió un error.");
  }
  return cuerpo as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (email: string, clave: string) => pedir<Sesion>("/auth/login", { method: "POST", body: json({ email, clave }) }),
  registro: (nombre: string, email: string, clave: string) =>
    pedir<Sesion>("/auth/registro", { method: "POST", body: json({ nombre, email, clave }) }),

  tableros: () => pedir<ResumenTablero[]>("/tableros"),
  crearTablero: (nombre: string) => pedir<Tablero>("/tableros", { method: "POST", body: json({ nombre }) }),
  tablero: (id: number) => pedir<Tablero>(`/tableros/${id}`),
  invitar: (id: number, email: string) => pedir(`/tableros/${id}/miembros`, { method: "POST", body: json({ email }) }),
  metricas: (id: number) => pedir<Metricas>(`/tableros/${id}/metricas`),
  actividad: (id: number) => pedir<Actividad[]>(`/tableros/${id}/actividad`),

  cambiarWip: (columnaId: number, limite_wip: number | null) =>
    pedir<Tablero>(`/columnas/${columnaId}`, { method: "PATCH", body: json({ limite_wip }) }),

  crearTarjeta: (tableroId: number, datos: Partial<Tarjeta>) =>
    pedir<Tarjeta>(`/tableros/${tableroId}/tarjetas`, { method: "POST", body: json(datos) }),
  editarTarjeta: (id: number, datos: Partial<Tarjeta>) =>
    pedir<Tarjeta>(`/tarjetas/${id}`, { method: "PATCH", body: json(datos) }),
  moverTarjeta: (id: number, columna_id: number, posicion: number) =>
    pedir<Tarjeta>(`/tarjetas/${id}/mover`, { method: "POST", body: json({ columna_id, posicion }) }),
  eliminarTarjeta: (id: number) => pedir<void>(`/tarjetas/${id}`, { method: "DELETE" }),
};
