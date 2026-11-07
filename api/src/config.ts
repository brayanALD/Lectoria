// Configuración por variables de entorno (nunca hay secretos en el repositorio).
//
//   PORT                       Puerto HTTP (por defecto 8080)
//   FIREBASE_PROJECT_ID        Proyecto de Firebase
//   FIREBASE_SERVICE_ACCOUNT   JSON (o JSON en base64) de la clave de la cuenta de servicio.
//                              Alternativa: GOOGLE_APPLICATION_CREDENTIALS = ruta del archivo.
//   CORS_ORIGINS               Orígenes web permitidos, separados por coma (vacío = ninguno; la app móvil no usa CORS)
//   RATE_LIMIT_PER_MINUTE      Solicitudes por minuto y usuario (por defecto 120)
//   OPENLIBRARY_CONTACT        Contacto para el User-Agent de Open Library (opcional)
//   GOOGLE_BOOKS_API_KEY       Clave de Google Books para el respaldo del catálogo (opcional)
//   FIRESTORE_EMULATOR_HOST    Solo desarrollo/pruebas: usa el emulador en vez de producción
export interface Config {
  port: number;
  projectId: string;
  serviceAccount: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  openLibraryContact: string;
  googleBooksKey: string;
}

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const limit = Number(env.RATE_LIMIT_PER_MINUTE);
  return {
    port: Number(env.PORT || 8080),
    projectId: env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || '',
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT || '',
    corsOrigins: String(env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    rateLimitPerMinute: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_RATE_LIMIT_PER_MINUTE,
    openLibraryContact: env.OPENLIBRARY_CONTACT || '',
    googleBooksKey: env.GOOGLE_BOOKS_API_KEY || '',
  };
}
