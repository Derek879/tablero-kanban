import { useState, type FormEvent } from "react";

import { api, type Sesion } from "../api";

export function Login({ alEntrar }: { alEntrar: (s: Sesion) => void }) {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const sesion = modo === "login" ? await api.login(email, clave) : await api.registro(nombre, email, clave);
      alEntrar(sesion);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="login">
      <form onSubmit={enviar} className="tarjeta-form">
        <h1>Tablero Kanban</h1>
        <p className="sutil">Organiza el trabajo de tu equipo y ve el avance en tiempo real.</p>
        {modo === "registro" && (
          <input placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        )}
        <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Clave (mínimo 8 caracteres)"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">{modo === "login" ? "Entrar" : "Crear cuenta"}</button>
        <button type="button" className="enlace" onClick={() => setModo(modo === "login" ? "registro" : "login")}>
          {modo === "login" ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
  );
}
