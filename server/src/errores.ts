export class ErrorHttp extends Error {
  constructor(public readonly status: number, mensaje: string) {
    super(mensaje);
  }
}

export const noEncontrado = (que: string) => new ErrorHttp(404, `${que} no existe.`);
export const prohibido = () => new ErrorHttp(403, "No eres miembro de este tablero.");
export const conflicto = (mensaje: string) => new ErrorHttp(409, mensaje);
