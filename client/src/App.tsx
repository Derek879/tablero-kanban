import { useState } from "react";

import { guardarSesion, sesionGuardada, type Sesion } from "./api";
import { ListaTableros } from "./components/ListaTableros";
import { Login } from "./components/Login";
import { Tablero } from "./components/Tablero";

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(sesionGuardada());
  const [tableroId, setTableroId] = useState<number | null>(null);

  if (!sesion) {
    return (
      <Login
        alEntrar={(s) => {
          guardarSesion(s);
          setSesion(s);
        }}
      />
    );
  }

  return (
    <>
      <nav className="barra-superior">
        <strong>Kanban</strong>
        <span className="espacio" />
        <span>{sesion.usuario.nombre}</span>
        <button
          className="enlace"
          onClick={() => {
            guardarSesion(null);
            setSesion(null);
          }}
        >
          Salir
        </button>
      </nav>
      {tableroId ? (
        <Tablero tableroId={tableroId} alVolver={() => setTableroId(null)} />
      ) : (
        <ListaTableros alAbrir={setTableroId} />
      )}
    </>
  );
}
