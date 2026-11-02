import { useEffect, useState, type FormEvent } from "react";

import { api } from "../api";
import type { ResumenTablero } from "../tipos";

export function ListaTableros({ alAbrir }: { alAbrir: (id: number) => void }) {
  const [tableros, setTableros] = useState<ResumenTablero[]>([]);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    api.tableros().then(setTableros);
  }, []);

  async function crear(e: FormEvent) {
    e.preventDefault();
    const t = await api.crearTablero(nombre);
    alAbrir(t.id);
  }

  return (
    <main className="lista">
      <h2>Mis tableros</h2>
      <form onSubmit={crear} className="fila">
        <input placeholder="Nombre del tablero, p. ej. Sprint 1" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <button type="submit">Crear tablero</button>
      </form>
      <ul>
        {tableros.map((t) => (
          <li key={t.id}>
            <button className="item-tablero" onClick={() => alAbrir(t.id)}>
              <strong>{t.nombre}</strong>
              <span className="sutil">
                {t.total_tarjetas} tarjetas · {t.rol}
              </span>
            </button>
          </li>
        ))}
        {tableros.length === 0 && <p className="sutil">Todavía no tienes tableros.</p>}
      </ul>
    </main>
  );
}
