import { useState, type FormEvent } from "react";

import type { Miembro, Prioridad, Tarjeta } from "../tipos";

interface Props {
  tarjeta: Tarjeta;
  miembros: Miembro[];
  alCerrar: () => void;
  alGuardar: (datos: Partial<Tarjeta>) => void;
  alEliminar: () => void;
}

export function EditarTarjeta({ tarjeta, miembros, alCerrar, alGuardar, alEliminar }: Props) {
  const [titulo, setTitulo] = useState(tarjeta.titulo);
  const [descripcion, setDescripcion] = useState(tarjeta.descripcion);
  const [prioridad, setPrioridad] = useState<Prioridad>(tarjeta.prioridad);
  const [responsable, setResponsable] = useState(tarjeta.responsable_id?.toString() ?? "");
  const [fecha, setFecha] = useState(tarjeta.fecha_limite ?? "");

  function guardar(e: FormEvent) {
    e.preventDefault();
    alGuardar({
      titulo,
      descripcion,
      prioridad,
      responsable_id: responsable ? Number(responsable) : null,
      fecha_limite: fecha || null,
    });
  }

  return (
    <div className="fondo-modal" onClick={alCerrar}>
      <form className="modal tarjeta-form" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <h3>Editar tarjeta</h3>
        <label>
          Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={120} />
        </label>
        <label>
          Descripción
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} />
        </label>
        <div className="fila">
          <label>
            Prioridad
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label>
            Responsable
            <select value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Sin asignar</option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha límite
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>
        <div className="fila acciones">
          <button
            type="button"
            className="peligro"
            onClick={() => confirm("¿Eliminar esta tarjeta?") && alEliminar()}
          >
            Eliminar
          </button>
          <span className="espacio" />
          <button type="button" className="enlace" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit">Guardar</button>
        </div>
      </form>
    </div>
  );
}
