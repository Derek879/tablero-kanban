import { useEffect, useState } from "react";

import { api } from "../api";
import type { Actividad, Metricas, Tablero } from "../tipos";

/** Se vuelve a pedir cada vez que cambia el tablero, así las métricas siguen al trabajo en vivo. */
export function PanelMetricas({ tablero }: { tablero: Tablero }) {
  const [m, setM] = useState<Metricas | null>(null);
  const [actividad, setActividad] = useState<Actividad[]>([]);

  useEffect(() => {
    api.metricas(tablero.id).then(setM);
    api.actividad(tablero.id).then(setActividad);
  }, [tablero]);

  if (!m) return null;
  const maximo = Math.max(1, ...m.throughput_semanal.map((s) => s.terminadas));

  return (
    <aside className="metricas">
      <h3>Métricas del flujo</h3>
      <div className="kpis">
        <Kpi titulo="Terminadas" valor={m.total_terminadas} />
        <Kpi titulo="Lead time" valor={dias(m.lead_time_dias)} ayuda="De creada a terminada" />
        <Kpi titulo="Cycle time" valor={dias(m.cycle_time_dias)} ayuda="De iniciada a terminada" />
      </div>

      <h4>Terminadas por semana</h4>
      <div className="barras">
        {m.throughput_semanal.map((s) => (
          <div key={s.desde} className="barra" title={`Semana desde ${s.desde}: ${s.terminadas}`}>
            <div style={{ height: `${(s.terminadas / maximo) * 100}%` }} />
            <span>{s.terminadas}</span>
          </div>
        ))}
      </div>

      <h4>Pendientes por persona</h4>
      <ul className="simple">
        {m.carga_por_responsable.map((c) => (
          <li key={c.responsable}>
            {c.responsable} <strong>{c.pendientes}</strong>
          </li>
        ))}
      </ul>

      {m.vencidas.length > 0 && (
        <>
          <h4 className="error">Vencidas</h4>
          <ul className="simple">
            {m.vencidas.map((v) => (
              <li key={v.id}>
                {v.titulo} <span className="sutil">{v.fecha_limite}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>Actividad reciente</h4>
      <ul className="simple actividad">
        {actividad.slice(0, 10).map((a) => (
          <li key={a.id}>
            <strong>{a.usuario}</strong> {a.descripcion}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Kpi({ titulo, valor, ayuda }: { titulo: string; valor: string | number; ayuda?: string }) {
  return (
    <div className="kpi" title={ayuda}>
      <span className="sutil">{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

const dias = (n: number | null) => (n == null ? "—" : `${n} d`);
