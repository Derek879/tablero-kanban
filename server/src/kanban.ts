import type { DB } from "./db.js";
import { conflicto, ErrorHttp, noEncontrado, prohibido } from "./errores.js";

export type Prioridad = "baja" | "media" | "alta";
export type Rol = "admin" | "miembro";

export interface Columna {
  id: number;
  tablero_id: number;
  nombre: string;
  posicion: number;
  limite_wip: number | null;
  es_final: number;
}

export interface Tarjeta {
  id: number;
  tablero_id: number;
  columna_id: number;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  responsable_id: number | null;
  fecha_limite: string | null;
  posicion: number;
  creada: string;
  iniciada: string | null;
  terminada: string | null;
}

export interface DatosTarjeta {
  titulo?: string;
  descripcion?: string;
  prioridad?: Prioridad;
  responsable_id?: number | null;
  fecha_limite?: string | null;
}

const COLUMNAS_INICIALES = [
  { nombre: "Por hacer", limite_wip: null, es_final: 0 },
  { nombre: "En progreso", limite_wip: 3, es_final: 0 },
  { nombre: "En revisión", limite_wip: 2, es_final: 0 },
  { nombre: "Hecho", limite_wip: null, es_final: 1 },
];

/** Reglas del tablero. El reloj se inyecta para poder probar las métricas de tiempo. */
export class Kanban {
  constructor(private readonly db: DB, private readonly ahora: () => Date = () => new Date()) {}

  // ---------- tableros y miembros ----------

  crearTablero(usuarioId: number, nombre: string): number {
    return this.db.transaction(() => {
      const { lastInsertRowid } = this.db
        .prepare("INSERT INTO tableros (nombre, creado_por) VALUES (?, ?)")
        .run(nombre, usuarioId);
      const tableroId = Number(lastInsertRowid);
      this.db
        .prepare("INSERT INTO miembros (tablero_id, usuario_id, rol) VALUES (?, ?, 'admin')")
        .run(tableroId, usuarioId);
      const insertar = this.db.prepare(
        "INSERT INTO columnas (tablero_id, nombre, posicion, limite_wip, es_final) VALUES (?, ?, ?, ?, ?)",
      );
      COLUMNAS_INICIALES.forEach((c, i) => insertar.run(tableroId, c.nombre, i, c.limite_wip, c.es_final));
      this.registrar(tableroId, usuarioId, `creó el tablero "${nombre}"`);
      return tableroId;
    })();
  }

  tablerosDe(usuarioId: number) {
    return this.db
      .prepare(
        `SELECT t.id, t.nombre, m.rol,
                (SELECT COUNT(*) FROM tarjetas WHERE tablero_id = t.id) AS total_tarjetas
         FROM tableros t JOIN miembros m ON m.tablero_id = t.id
         WHERE m.usuario_id = ? ORDER BY t.id DESC`,
      )
      .all(usuarioId);
  }

  rolEn(tableroId: number, usuarioId: number): Rol {
    const existe = this.db.prepare("SELECT 1 FROM tableros WHERE id = ?").get(tableroId);
    if (!existe) throw noEncontrado("El tablero");
    const fila = this.db
      .prepare("SELECT rol FROM miembros WHERE tablero_id = ? AND usuario_id = ?")
      .get(tableroId, usuarioId) as { rol: Rol } | undefined;
    if (!fila) throw prohibido();
    return fila.rol;
  }

  agregarMiembro(tableroId: number, adminId: number, email: string) {
    if (this.rolEn(tableroId, adminId) !== "admin") {
      throw new ErrorHttp(403, "Solo un administrador puede invitar miembros.");
    }
    const usuario = this.db
      .prepare("SELECT id, nombre FROM usuarios WHERE email = ?")
      .get(email.toLowerCase()) as { id: number; nombre: string } | undefined;
    if (!usuario) throw noEncontrado("El usuario con ese correo");
    const resultado = this.db
      .prepare("INSERT OR IGNORE INTO miembros (tablero_id, usuario_id, rol) VALUES (?, ?, 'miembro')")
      .run(tableroId, usuario.id);
    if (resultado.changes === 0) throw conflicto("Esa persona ya es miembro del tablero.");
    this.registrar(tableroId, adminId, `agregó a ${usuario.nombre} al tablero`);
    return usuario;
  }

  obtenerTablero(tableroId: number) {
    const tablero = this.db.prepare("SELECT id, nombre FROM tableros WHERE id = ?").get(tableroId);
    if (!tablero) throw noEncontrado("El tablero");
    const columnas = this.db
      .prepare("SELECT * FROM columnas WHERE tablero_id = ? ORDER BY posicion")
      .all(tableroId) as Columna[];
    const tarjetas = this.db
      .prepare(
        `SELECT t.*, u.nombre AS responsable_nombre FROM tarjetas t
         LEFT JOIN usuarios u ON u.id = t.responsable_id
         WHERE t.tablero_id = ? ORDER BY t.posicion`,
      )
      .all(tableroId) as (Tarjeta & { responsable_nombre: string | null })[];
    const miembros = this.db
      .prepare(
        `SELECT u.id, u.nombre, u.email, m.rol FROM miembros m
         JOIN usuarios u ON u.id = m.usuario_id WHERE m.tablero_id = ? ORDER BY u.nombre`,
      )
      .all(tableroId);
    return {
      ...(tablero as { id: number; nombre: string }),
      miembros,
      columnas: columnas.map((c) => ({ ...c, tarjetas: tarjetas.filter((t) => t.columna_id === c.id) })),
    };
  }

  // ---------- columnas ----------

  actualizarColumna(columnaId: number, usuarioId: number, datos: { nombre?: string; limite_wip?: number | null }) {
    const columna = this.columna(columnaId);
    if (this.rolEn(columna.tablero_id, usuarioId) !== "admin") {
      throw new ErrorHttp(403, "Solo un administrador puede cambiar las columnas.");
    }
    if (datos.limite_wip != null && this.contarEn(columnaId) > datos.limite_wip) {
      throw conflicto(
        `La columna ya tiene ${this.contarEn(columnaId)} tarjetas; mueve algunas antes de bajar el límite.`,
      );
    }
    this.db
      .prepare("UPDATE columnas SET nombre = COALESCE(?, nombre), limite_wip = ? WHERE id = ?")
      .run(datos.nombre ?? null, datos.limite_wip === undefined ? columna.limite_wip : datos.limite_wip, columnaId);
    return columna.tablero_id;
  }

  // ---------- tarjetas ----------

  crearTarjeta(tableroId: number, usuarioId: number, datos: DatosTarjeta & { titulo: string; columna_id?: number }) {
    this.rolEn(tableroId, usuarioId);
    const columna = datos.columna_id
      ? this.columna(datos.columna_id)
      : (this.db
          .prepare("SELECT * FROM columnas WHERE tablero_id = ? ORDER BY posicion LIMIT 1")
          .get(tableroId) as Columna);
    if (columna.tablero_id !== tableroId) throw conflicto("La columna no pertenece a este tablero.");
    this.validarResponsable(tableroId, datos.responsable_id);
    this.validarWip(columna);

    const ahora = this.ahora().toISOString();
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO tarjetas (tablero_id, columna_id, titulo, descripcion, prioridad, responsable_id,
                               fecha_limite, posicion, creada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tableroId,
        columna.id,
        datos.titulo,
        datos.descripcion ?? "",
        datos.prioridad ?? "media",
        datos.responsable_id ?? null,
        datos.fecha_limite ?? null,
        this.contarEn(columna.id),
        ahora,
      );
    this.registrar(tableroId, usuarioId, `creó la tarjeta "${datos.titulo}" en ${columna.nombre}`);
    return this.tarjeta(Number(lastInsertRowid));
  }

  actualizarTarjeta(tarjetaId: number, usuarioId: number, datos: DatosTarjeta) {
    const tarjeta = this.tarjeta(tarjetaId);
    this.rolEn(tarjeta.tablero_id, usuarioId);
    this.validarResponsable(tarjeta.tablero_id, datos.responsable_id);
    const nueva = { ...tarjeta, ...datos };
    this.db
      .prepare(
        `UPDATE tarjetas SET titulo = ?, descripcion = ?, prioridad = ?, responsable_id = ?, fecha_limite = ?
         WHERE id = ?`,
      )
      .run(nueva.titulo, nueva.descripcion, nueva.prioridad, nueva.responsable_id, nueva.fecha_limite, tarjetaId);
    this.registrar(tarjeta.tablero_id, usuarioId, `editó la tarjeta "${nueva.titulo}"`);
    return this.tarjeta(tarjetaId);
  }

  /**
   * Mueve una tarjeta a otra columna (o dentro de la misma) en la posición indicada.
   * Reordena las demás tarjetas en una sola transacción y respeta el límite WIP del destino.
   */
  moverTarjeta(tarjetaId: number, usuarioId: number, columnaDestinoId: number, posicion: number) {
    return this.db.transaction(() => {
      const tarjeta = this.tarjeta(tarjetaId);
      this.rolEn(tarjeta.tablero_id, usuarioId);
      const destino = this.columna(columnaDestinoId);
      if (destino.tablero_id !== tarjeta.tablero_id) throw conflicto("La columna no pertenece a este tablero.");
      const cambiaDeColumna = destino.id !== tarjeta.columna_id;
      if (cambiaDeColumna) this.validarWip(destino);

      // Saco la tarjeta de su columna y cierro el hueco.
      this.db
        .prepare("UPDATE tarjetas SET posicion = posicion - 1 WHERE columna_id = ? AND posicion > ?")
        .run(tarjeta.columna_id, tarjeta.posicion);
      const maximo = this.contarEn(destino.id) - (cambiaDeColumna ? 0 : 1);
      const pos = Math.max(0, Math.min(posicion, maximo));
      // Abro espacio en la columna destino.
      this.db
        .prepare("UPDATE tarjetas SET posicion = posicion + 1 WHERE columna_id = ? AND posicion >= ? AND id != ?")
        .run(destino.id, pos, tarjetaId);

      const ahora = this.ahora().toISOString();
      const primera = this.db
        .prepare("SELECT id FROM columnas WHERE tablero_id = ? ORDER BY posicion LIMIT 1")
        .get(tarjeta.tablero_id) as { id: number };
      const iniciada = tarjeta.iniciada ?? (destino.id !== primera.id ? ahora : null);
      const terminada = destino.es_final ? (tarjeta.terminada ?? ahora) : null;
      this.db
        .prepare("UPDATE tarjetas SET columna_id = ?, posicion = ?, iniciada = ?, terminada = ? WHERE id = ?")
        .run(destino.id, pos, iniciada, terminada, tarjetaId);

      if (cambiaDeColumna) {
        this.registrar(tarjeta.tablero_id, usuarioId, `movió "${tarjeta.titulo}" a ${destino.nombre}`);
      }
      return this.tarjeta(tarjetaId);
    })();
  }

  eliminarTarjeta(tarjetaId: number, usuarioId: number) {
    const tarjeta = this.tarjeta(tarjetaId);
    this.rolEn(tarjeta.tablero_id, usuarioId);
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM tarjetas WHERE id = ?").run(tarjetaId);
      this.db
        .prepare("UPDATE tarjetas SET posicion = posicion - 1 WHERE columna_id = ? AND posicion > ?")
        .run(tarjeta.columna_id, tarjeta.posicion);
      this.registrar(tarjeta.tablero_id, usuarioId, `eliminó la tarjeta "${tarjeta.titulo}"`);
    })();
    return tarjeta.tablero_id;
  }

  actividad(tableroId: number, limite = 30) {
    return this.db
      .prepare(
        `SELECT a.id, a.descripcion, a.fecha, u.nombre AS usuario FROM actividad a
         JOIN usuarios u ON u.id = a.usuario_id WHERE a.tablero_id = ? ORDER BY a.id DESC LIMIT ?`,
      )
      .all(tableroId, limite);
  }

  // ---------- auxiliares ----------

  tarjeta(id: number): Tarjeta {
    const t = this.db.prepare("SELECT * FROM tarjetas WHERE id = ?").get(id) as Tarjeta | undefined;
    if (!t) throw noEncontrado("La tarjeta");
    return t;
  }

  private columna(id: number): Columna {
    const c = this.db.prepare("SELECT * FROM columnas WHERE id = ?").get(id) as Columna | undefined;
    if (!c) throw noEncontrado("La columna");
    return c;
  }

  private contarEn(columnaId: number): number {
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM tarjetas WHERE columna_id = ?").get(columnaId) as {
      n: number;
    };
    return n;
  }

  private validarWip(columna: Columna) {
    if (columna.limite_wip != null && this.contarEn(columna.id) >= columna.limite_wip) {
      throw conflicto(
        `"${columna.nombre}" llegó a su límite de ${columna.limite_wip} tarjetas. Termina algo antes de empezar otra cosa.`,
      );
    }
  }

  private validarResponsable(tableroId: number, responsableId?: number | null) {
    if (responsableId == null) return;
    const esMiembro = this.db
      .prepare("SELECT 1 FROM miembros WHERE tablero_id = ? AND usuario_id = ?")
      .get(tableroId, responsableId);
    if (!esMiembro) throw conflicto("El responsable debe ser miembro del tablero.");
  }

  private registrar(tableroId: number, usuarioId: number, descripcion: string) {
    this.db
      .prepare("INSERT INTO actividad (tablero_id, usuario_id, descripcion, fecha) VALUES (?, ?, ?, ?)")
      .run(tableroId, usuarioId, descripcion, this.ahora().toISOString());
  }
}
