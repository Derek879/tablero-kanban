import { describe, expect, it } from "vitest";

import { entorno } from "./ayuda.js";

describe("autenticación", () => {
  it("registra e inicia sesión", async () => {
    const { api } = entorno();
    await api.post("/api/auth/registro").send({ nombre: "Ana", email: "Ana@Correo.com", clave: "clave-segura" });
    const r = await api.post("/api/auth/login").send({ email: "ana@correo.com", clave: "clave-segura" });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTypeOf("string");
  });

  it("no revela si el correo existe", async () => {
    const { api, registrar } = entorno();
    await registrar("Ana", "ana@correo.com");
    const malaClave = await api.post("/api/auth/login").send({ email: "ana@correo.com", clave: "otra-clave" });
    const noExiste = await api.post("/api/auth/login").send({ email: "nadie@correo.com", clave: "x" });
    expect(malaClave.status).toBe(401);
    expect(noExiste.body).toEqual(malaClave.body);
  });

  it("rechaza correo repetido y clave corta", async () => {
    const { api, registrar } = entorno();
    await registrar("Ana", "ana@correo.com");
    const repetido = await api.post("/api/auth/registro").send({ nombre: "Ana", email: "ana@correo.com", clave: "clave-segura" });
    const corta = await api.post("/api/auth/registro").send({ nombre: "Luis", email: "luis@correo.com", clave: "123" });
    expect(repetido.status).toBe(409);
    expect(corta.status).toBe(400);
  });

  it("protege la API sin token", async () => {
    const { api } = entorno();
    expect((await api.get("/api/tableros")).status).toBe(401);
  });
});
