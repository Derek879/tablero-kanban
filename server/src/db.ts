import Database from "better-sqlite3";

export type DB = Database.Database;

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tableros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  creado_por INTEGER NOT NULL REFERENCES usuarios(id),
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS miembros (
  tablero_id INTEGER NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'miembro')),
  PRIMARY KEY (tablero_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS columnas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tablero_id INTEGER NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  posicion INTEGER NOT NULL,
  limite_wip INTEGER,              -- NULL = sin límite
  es_final INTEGER NOT NULL DEFAULT 0  -- 1 = las tarjetas aquí cuentan como terminadas
);

CREATE TABLE IF NOT EXISTS tarjetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tablero_id INTEGER NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  columna_id INTEGER NOT NULL REFERENCES columnas(id),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta')),
  responsable_id INTEGER REFERENCES usuarios(id),
  fecha_limite TEXT,
  posicion INTEGER NOT NULL,
  creada TEXT NOT NULL,
  iniciada TEXT,     -- primera vez que salió de la primera columna
  terminada TEXT     -- cuando llegó a una columna final
);

CREATE TABLE IF NOT EXISTS actividad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tablero_id INTEGER NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  descripcion TEXT NOT NULL,
  fecha TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tarjetas_columna ON tarjetas(columna_id, posicion);
CREATE INDEX IF NOT EXISTS idx_actividad_tablero ON actividad(tablero_id, id DESC);
`;

export function crearBaseDeDatos(ruta = process.env.DB_PATH ?? "kanban.db"): DB {
  const db = new Database(ruta);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(ESQUEMA);
  return db;
}
