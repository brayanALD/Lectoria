// Errores de la API. Todos se responden con { error: { code, message, fields? } }.
//
//   400 VALIDATION        datos inválidos (fields: { campo: mensaje })
//   401 UNAUTHENTICATED   falta el token o no es válido
//   404 NOT_FOUND         el recurso no existe (o no es de este usuario)
//   409 <código de negocio>  p. ej. BOOK_NOT_OWNED
//   429 RATE_LIMITED      demasiadas solicitudes
//   503 BUSY              Firestore saturado o sin respuesta: el cliente reintenta
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const validation = (fields: Record<string, string>, message = 'Los datos enviados no son válidos.') =>
  new ApiError(400, 'VALIDATION', message, fields);
export const unauthenticated = (message = 'Inicia sesión para continuar.') =>
  new ApiError(401, 'UNAUTHENTICATED', message);
export const notFound = (message = 'No se encontró lo solicitado.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
