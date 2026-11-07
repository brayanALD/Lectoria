import { createApp } from './app';
import { readConfig } from './config';
import { initFirebase } from './firebase';

const config = readConfig();
const { db, auth } = initFirebase(config);

const app = createApp({
  ctx: { db, now: () => new Date(), config, fetchFn: fetch, log: console },
  verifyToken: (token) => auth.verifyIdToken(token),
  corsOrigins: config.corsOrigins,
  rateLimitPerMinute: config.rateLimitPerMinute,
});

const server = app.listen(config.port, () => {
  console.log(`API de Lectoria escuchando en el puerto ${config.port}`);
});

// Render envía SIGTERM al reemplazar el servicio: se termina lo que está en curso antes de salir.
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
