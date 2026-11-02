import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from "react";
import { io } from "socket.io-client";

import { api, sesionGuardada } from "../api";
import type { Columna, Tablero as TipoTablero, Tarjeta } from "../tipos";
import { EditarTarjeta } from "./EditarTarjeta";
import { PanelMetricas } from "./PanelMetricas";

interface Props {
  tableroId: number;
  alVolver: () => void;
}

export function Tablero({ tableroId, alVolver }: Props) {
  const [tablero, setTablero] = useState<TipoTablero | null>(null);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<Tarjeta | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [verMetricas, setVerMetricas] = useState(false);
  const [conectado, setConectado] = useState(false);

  const mostrarAviso = useCallback((mensaje: string) => {
    setAviso(mensaje);
    setTimeout(() => setAviso(""), 4000);
  }, []);

  // Carga inicial y suscripción en tiempo real: el servidor manda el tablero completo en cada cambio.
  useEffect(() => {
    api.tablero(tableroId).then(setTablero);
    const socket = io({ auth: { token: sesionGuardada()?.token } });
    socket.on("connect", () => {
      setConectado(true);
      socket.emit("tablero:unirse", tableroId);
    });
    socket.on("disconnect", () => setConectado(false));
    socket.on("tablero:actualizado", setTablero);
    return () => {
      socket.disconnect();
    };
  }, [tableroId]);

  async function intentar(accion: () => Promise<unknown>) {
    try {
      await accion();
    } catch (e) {
      mostrarAviso((e as Error).message);
    }
  }

  function soltar(e: DragEvent, columna: Columna, posicion: number) {
    e.preventDefault();
    e.stopPropagation();
    const id = Number(e.dataTransfer.getData("text/plain"));
    setArrastrando(null);
    if (id) intentar(() => api.moverTarjeta(id, columna.id, posicion));
  }

  if (!tablero) return <p className="cargando">Cargando tablero…</p>;

  return (
    <div className="tablero">
      <header className="cabecera">
        <button className="enlace" onClick={alVolver}>
          ← Mis tableros
        </button>
        <h2>{tablero.nombre}</h2>
        <span className={conectado ? "estado en-linea" : "estado"}>{conectado ? "En vivo" : "Sin conexión"}</span>
        <Miembros tablero={tablero} alError={mostrarAviso} />
        <button onClick={() => setVerMetricas(!verMetricas)}>{verMetricas ? "Ocultar métricas" : "Métricas"}</button>
      </header>

      {aviso && (
        <div className="aviso" role="alert">
          {aviso}
        </div>
      )}

      <div className="contenido">
        <section className="columnas">
          {tablero.columnas.map((columna) => {
            const lleno = columna.limite_wip != null && columna.tarjetas.length >= columna.limite_wip;
            return (
              <div
                key={columna.id}
                className={`columna ${lleno ? "llena" : ""} ${arrastrando ? "zona" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => soltar(e, columna, columna.tarjetas.length)}
              >
                <div className="columna-cabecera">
                  <h3>{columna.nombre}</h3>
                  <LimiteWip columna={columna} alCambiar={(n) => intentar(() => api.cambiarWip(columna.id, n))} />
                </div>
                {columna.tarjetas.map((t, i) => (
                  <article
                    key={t.id}
                    className={`tarjeta prioridad-${t.prioridad} ${arrastrando === t.id ? "fantasma" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(t.id));
                      setArrastrando(t.id);
                    }}
                    onDragEnd={() => setArrastrando(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => soltar(e, columna, i)}
                    onClick={() => setEditando(t)}
                  >
                    <p>{t.titulo}</p>
                    <footer>
                      {t.responsable_nombre && <span className="chip">{t.responsable_nombre}</span>}
                      {t.fecha_limite && <Fecha fecha={t.fecha_limite} terminada={!!t.terminada} />}
                    </footer>
                  </article>
                ))}
                {columna.id === tablero.columnas[0].id && (
                  <NuevaTarjeta alCrear={(titulo) => intentar(() => api.crearTarjeta(tablero.id, { titulo }))} />
                )}
              </div>
            );
          })}
        </section>
        {verMetricas && <PanelMetricas tablero={tablero} />}
      </div>

      {editando && (
        <EditarTarjeta
          tarjeta={editando}
          miembros={tablero.miembros}
          alCerrar={() => setEditando(null)}
          alGuardar={(datos) => intentar(() => api.editarTarjeta(editando.id, datos)).then(() => setEditando(null))}
          alEliminar={() => intentar(() => api.eliminarTarjeta(editando.id)).then(() => setEditando(null))}
        />
      )}
    </div>
  );
}

function LimiteWip({ columna, alCambiar }: { columna: Columna; alCambiar: (n: number | null) => void }) {
  const texto = columna.limite_wip == null ? `${columna.tarjetas.length}` : `${columna.tarjetas.length}/${columna.limite_wip}`;
  return (
    <button
      className="wip"
      title="Límite de trabajo en curso (WIP). Clic para cambiarlo."
      onClick={() => {
        const valor = prompt("Límite WIP (vacío = sin límite)", columna.limite_wip?.toString() ?? "");
        if (valor === null) return;
        alCambiar(valor.trim() === "" ? null : Number(valor));
      }}
    >
      {texto}
    </button>
  );
}

function Fecha({ fecha, terminada }: { fecha: string; terminada: boolean }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const vencida = !terminada && fecha < hoy;
  const [a, m, d] = fecha.split("-");
  return <span className={`chip ${vencida ? "vencida" : ""}`}>{`${d}/${m}/${a}`}</span>;
}

function NuevaTarjeta({ alCrear }: { alCrear: (titulo: string) => void }) {
  const [titulo, setTitulo] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    alCrear(titulo.trim());
    setTitulo("");
  }
  return (
    <form onSubmit={enviar} className="nueva-tarjeta">
      <input placeholder="+ Nueva tarjeta" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
    </form>
  );
}

function Miembros({ tablero, alError }: { tablero: TipoTablero; alError: (m: string) => void }) {
  const soyAdmin = tablero.miembros.find((m) => m.id === sesionGuardada()?.usuario.id)?.rol === "admin";
  return (
    <div className="miembros">
      {tablero.miembros.map((m) => (
        <span key={m.id} className="avatar" title={`${m.nombre} (${m.rol})`}>
          {m.nombre.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {soyAdmin && (
        <button
          className="enlace"
          onClick={() => {
            const email = prompt("Correo de la persona a invitar (debe tener cuenta)");
            if (email) api.invitar(tablero.id, email).catch((e) => alError(e.message));
          }}
        >
          + Invitar
        </button>
      )}
    </div>
  );
}
