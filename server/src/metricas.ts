import type { DB } from "./db.js";

const DIA_MS = 24 * 60 * 60 * 1000;

function promedioDias(pares: [string, string][]): number | null {
  if (pares.length === 0) return null;
  const total = pares.reduce((suma, [desde, hasta]) => suma + (Date.parse(hasta) - Date.parse(desde)), 0);
  return Math.round((total / pares.length / DIA_MS) * 10) / 10;
}

/**
 * Métricas de flujo del tablero:
 * - lead time: desde que se crea la tarjeta hasta que se termina (lo que espera el cliente);
 * - cycle time: desde que se empieza a trabajar hasta que se termina (lo que tarda el equipo);
 * - throughput: tarjetas terminadas por semana en las últimas 4 semanas.
 */
export function calcularMetricas(db: DB, tableroId: number, ahora = new Date()) {
  const terminadas = db
    .prepare("SELECT creada, iniciada, terminada FROM tarjetas WHERE tablero_id = ? AND terminada IS NOT NULL")
    .all(tableroId) as { creada: string; iniciada: string | null; terminada: string }[];

  const semanas = [3, 2, 1, 0].map((haceSemanas) => {
    const fin = ahora.getTime() - haceSemanas * 7 * DIA_MS;
    const inicio = fin - 7 * DIA_MS;
    return {
      desde: new Date(inicio).toISOString().slice(0, 10),
      terminadas: terminadas.filter((t) => {
        const ms = Date.parse(t.terminada);
        return ms > inicio && ms <= fin;
      }).length,
    };
  });

  const wip = db
    .prepare(
      `SELECT c.nombre, c.limite_wip, COUNT(t.id) AS tarjetas FROM columnas c
       LEFT JOIN tarjetas t ON t.columna_id = c.id
       WHERE c.tablero_id = ? GROUP BY c.id ORDER BY c.posicion`,
    )
    .all(tableroId);

  const carga = db
    .prepare(
      `SELECT COALESCE(u.nombre, 'Sin asignar') AS responsable, COUNT(*) AS pendientes
       FROM tarjetas t LEFT JOIN usuarios u ON u.id = t.responsable_id
       WHERE t.tablero_id = ? AND t.terminada IS NULL
       GROUP BY t.responsable_id ORDER BY pendientes DESC`,
    )
    .all(tableroId);

  const hoy = ahora.toISOString().slice(0, 10);
  const vencidas = db
    .prepare(
      `SELECT id, titulo, fecha_limite FROM tarjetas
       WHERE tablero_id = ? AND terminada IS NULL AND fecha_limite IS NOT NULL AND fecha_limite < ?
       ORDER BY fecha_limite`,
    )
    .all(tableroId, hoy);

  return {
    total_terminadas: terminadas.length,
    lead_time_dias: promedioDias(terminadas.map((t) => [t.creada, t.terminada])),
    cycle_time_dias: promedioDias(
      terminadas.filter((t) => t.iniciada).map((t) => [t.iniciada as string, t.terminada]),
    ),
    throughput_semanal: semanas,
    wip,
    carga_por_responsable: carga,
    vencidas,
  };
}
