import { describe, expect, it } from "vitest";

import { entorno } from "./ayuda.js";

describe("métricas de flujo", () => {
  it("calcula lead time, cycle time y throughput con un reloj controlado", async () => {
    let ahora = new Date("2026-11-02T09:00:00Z");
    const { api, registrar, tablero } = entorno(() => ahora);
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);

    const tarjeta = (await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "Login" })).body;
    ahora = new Date("2026-11-04T09:00:00Z"); // 2 días esperando
    await api.post(`/api/tarjetas/${tarjeta.id}/mover`).set(ana.auth).send({ columna_id: t.enProgreso, posicion: 0 });
    ahora = new Date("2026-11-05T09:00:00Z"); // 1 día de trabajo
    await api.post(`/api/tarjetas/${tarjeta.id}/mover`).set(ana.auth).send({ columna_id: t.hecho, posicion: 0 });

    await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "Reportes", fecha_limite: "2026-11-03" });

    const m = (await api.get(`/api/tableros/${t.id}/metricas`).set(ana.auth)).body;
    expect(m.lead_time_dias).toBe(3);
    expect(m.cycle_time_dias).toBe(1);
    expect(m.throughput_semanal.at(-1).terminadas).toBe(1);
    expect(m.vencidas.map((v: { titulo: string }) => v.titulo)).toEqual(["Reportes"]);
    expect(m.carga_por_responsable).toEqual([{ responsable: "Sin asignar", pendientes: 1 }]);
  });

  it("si una tarjeta sale de Hecho deja de contar como terminada", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    const c = (await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "Login" })).body;
    await api.post(`/api/tarjetas/${c.id}/mover`).set(ana.auth).send({ columna_id: t.hecho, posicion: 0 });
    const reabierta = await api.post(`/api/tarjetas/${c.id}/mover`).set(ana.auth).send({ columna_id: t.enRevision, posicion: 0 });
    expect(reabierta.body.terminada).toBeNull();
  });
});
