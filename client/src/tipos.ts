export type Prioridad = "baja" | "media" | "alta";

export interface Usuario {
  id: number;
  nombre: string;
}

export interface Miembro extends Usuario {
  email: string;
  rol: "admin" | "miembro";
}

export interface Tarjeta {
  id: number;
  columna_id: number;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  responsable_id: number | null;
  responsable_nombre?: string | null;
  fecha_limite: string | null;
  posicion: number;
  terminada: string | null;
}

export interface Columna {
  id: number;
  nombre: string;
  limite_wip: number | null;
  es_final: number;
  tarjetas: Tarjeta[];
}

export interface Tablero {
  id: number;
  nombre: string;
  miembros: Miembro[];
  columnas: Columna[];
}

export interface ResumenTablero {
  id: number;
  nombre: string;
  rol: string;
  total_tarjetas: number;
}

export interface Metricas {
  total_terminadas: number;
  lead_time_dias: number | null;
  cycle_time_dias: number | null;
  throughput_semanal: { desde: string; terminadas: number }[];
  wip: { nombre: string; limite_wip: number | null; tarjetas: number }[];
  carga_por_responsable: { responsable: string; pendientes: number }[];
  vencidas: { id: number; titulo: string; fecha_limite: string }[];
}

export interface Actividad {
  id: number;
  descripcion: string;
  fecha: string;
  usuario: string;
}
