import { describe, expect, it } from "vitest";

import { entorno } from "./ayuda.js";

describe("tablero", () => {
  it("crea el tablero con las cuatro columnas y límites WIP por defecto", async () => {
    const { api, registrar } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const r = await api.post("/api/tableros").set(ana.auth).send({ nombre: "Sprint 1" });
    expect(r.status).toBe(201);
    expect(r.body.columnas.map((c: { nombre: string; limite_wip: number | null }) => [c.nombre, c.limite_wip])).toEqual([
      ["Por hacer", null],
      ["En progreso", 3],
      ["En revisión", 2],
      ["Hecho", null],
    ]);
  });

  it("solo los miembros ven el tablero", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const luis = await registrar("Luis", "luis@correo.com");
    const t = await tablero(ana.auth);
    expect((await api.get(`/api/tableros/${t.id}`).set(luis.auth)).status).toBe(403);
    await api.post(`/api/tableros/${t.id}/miembros`).set(ana.auth).send({ email: "luis@correo.com" });
    expect((await api.get(`/api/tableros/${t.id}`).set(luis.auth)).status).toBe(200);
  });

  it("solo el admin invita miembros", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const luis = await registrar("Luis", "luis@correo.com");
    await registrar("Rosa", "rosa@correo.com");
    const t = await tablero(ana.auth);
    await api.post(`/api/tableros/${t.id}/miembros`).set(ana.auth).send({ email: "luis@correo.com" });
    const r = await api.post(`/api/tableros/${t.id}/miembros`).set(luis.auth).send({ email: "rosa@correo.com" });
    expect(r.status).toBe(403);
  });

  it("el responsable de una tarjeta debe ser miembro", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const luis = await registrar("Luis", "luis@correo.com");
    const t = await tablero(ana.auth);
    const r = await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "Login", responsable_id: luis.id });
    expect(r.status).toBe(409);
  });
});

describe("tarjetas y límite WIP", () => {
  it("crea tarjetas al final de Por hacer y avisa a los conectados", async () => {
    const { api, registrar, tablero, notificados } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "A" });
    const b = await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "B", prioridad: "alta" });
    expect(b.body).toMatchObject({ columna_id: t.porHacer, posicion: 1, prioridad: "alta" });
    expect(notificados).toEqual([t.id, t.id]);
  });

  it("no deja pasar el límite WIP de una columna", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    const ids: number[] = [];
    for (const titulo of ["A", "B", "C"]) {
      const r = await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo });
      ids.push(r.body.id);
    }
    await api.post(`/api/tarjetas/${ids[0]}/mover`).set(ana.auth).send({ columna_id: t.enRevision, posicion: 0 });
    await api.post(`/api/tarjetas/${ids[1]}/mover`).set(ana.auth).send({ columna_id: t.enRevision, posicion: 0 });
    const r = await api.post(`/api/tarjetas/${ids[2]}/mover`).set(ana.auth).send({ columna_id: t.enRevision, posicion: 0 });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain("límite de 2");
  });

  it("reordena las posiciones al mover", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    const ids: number[] = [];
    for (const titulo of ["A", "B", "C"]) {
      ids.push((await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo })).body.id);
    }
    // Muevo C al inicio de la misma columna, y luego A a En progreso.
    await api.post(`/api/tarjetas/${ids[2]}/mover`).set(ana.auth).send({ columna_id: t.porHacer, posicion: 0 });
    await api.post(`/api/tarjetas/${ids[0]}/mover`).set(ana.auth).send({ columna_id: t.enProgreso, posicion: 5 });
    const r = await api.get(`/api/tableros/${t.id}`).set(ana.auth);
    const titulos = r.body.columnas.map((c: { tarjetas: { titulo: string; posicion: number }[] }) =>
      c.tarjetas.map((x) => `${x.titulo}${x.posicion}`),
    );
    expect(titulos).toEqual([["C0", "B1"], ["A0"], [], []]);
  });

  it("no baja el límite WIP por debajo de lo que ya hay", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    for (const titulo of ["A", "B"]) {
      await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo, columna_id: t.enProgreso });
    }
    expect((await api.patch(`/api/columnas/${t.enProgreso}`).set(ana.auth).send({ limite_wip: 1 })).status).toBe(409);
    expect((await api.patch(`/api/columnas/${t.enProgreso}`).set(ana.auth).send({ limite_wip: null })).status).toBe(200);
  });

  it("valida los datos de entrada", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    const r = await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "", prioridad: "urgente" });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.detalles)).toEqual(expect.arrayContaining(["titulo", "prioridad"]));
  });

  it("registra la actividad del tablero", async () => {
    const { api, registrar, tablero } = entorno();
    const ana = await registrar("Ana", "ana@correo.com");
    const t = await tablero(ana.auth);
    const c = await api.post(`/api/tableros/${t.id}/tarjetas`).set(ana.auth).send({ titulo: "Login" });
    await api.post(`/api/tarjetas/${c.body.id}/mover`).set(ana.auth).send({ columna_id: t.enProgreso, posicion: 0 });
    const r = await api.get(`/api/tableros/${t.id}/actividad`).set(ana.auth);
    expect(r.body[0].descripcion).toBe('movió "Login" a En progreso');
  });
});
