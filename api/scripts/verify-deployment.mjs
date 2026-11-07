// Comprobación de solo lectura de una API desplegada. No crea ni modifica datos.
//
//   API_URL=https://lectoria-api.onrender.com \
//   FIREBASE_API_KEY=<EXPO_PUBLIC_FIREBASE_API_KEY> \
//   EMAIL=alguien@correo.com PASSWORD=su-clave \
//   node api/scripts/verify-deployment.mjs
//
// Sin EMAIL/PASSWORD solo comprueba lo que no necesita sesión (salud y rechazo sin token).
// Con ellos, además: 1) inicia sesión en Firebase Auth, 2) comprueba que la API acepta ese token (Admin SDK y cuenta de
// servicio funcionando) y 3) busca un ISBN conocido en el catálogo. Nada de esto escribe en Firestore.
const { API_URL, FIREBASE_API_KEY, EMAIL, PASSWORD } = process.env;
if (!API_URL) {
  console.error('Falta API_URL (la dirección pública de la API).');
  process.exit(2);
}
const base = API_URL.replace(/\/+$/, '');
let failures = 0;
const step = (ok, text) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${text}`);
  if (!ok) failures += 1;
};

// En el plan gratuito de Render, la primera petición tras un rato sin uso tarda en despertar el servicio.
async function timed(url, init) {
  const started = Date.now();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
  return { response, ms: Date.now() - started };
}

try {
  const { response: health, ms } = await timed(`${base}/v1/salud`);
  const body = await health.json().catch(() => ({}));
  step(health.ok && body.status === 'ok', `GET /v1/salud -> ${health.status} (${ms} ms)`);

  const { response: anonymous } = await timed(`${base}/v1/me`);
  step(anonymous.status === 401, `GET /v1/me sin token -> ${anonymous.status} (se espera 401)`);

  const { response: junk } = await timed(`${base}/v1/me`, { headers: { Authorization: 'Bearer token-falso' } });
  step(junk.status === 401, `GET /v1/me con un token falso -> ${junk.status} (se espera 401)`);

  const { response: missing } = await timed(`${base}/v1/ruta-que-no-existe`, { headers: { Authorization: 'Bearer token-falso' } });
  step([401, 404].includes(missing.status), `ruta desconocida -> ${missing.status}`);

  if (EMAIL && PASSWORD && FIREBASE_API_KEY) {
    const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    });
    const { idToken } = await login.json();
    step(Boolean(idToken), 'inicio de sesión en Firebase Auth');

    if (idToken) {
      const auth = { Authorization: `Bearer ${idToken}` };
      const { response: me } = await timed(`${base}/v1/me`, { headers: auth });
      const data = await me.json().catch(() => ({}));
      step(me.ok && typeof data.uid === 'string', `GET /v1/me con token real -> ${me.status}${me.ok ? ' (uid recibido)' : ''}`);

      const { response: isbn, ms: isbnMs } = await timed(`${base}/v1/catalog/isbn/9780306406157`, { headers: auth });
      const found = await isbn.json().catch(() => ({}));
      step(isbn.ok && 'book' in found, `GET /v1/catalog/isbn/... -> ${isbn.status} (${isbnMs} ms, ${found.book ? 'encontrado' : 'sin resultado'})`);
    }
  } else {
    console.log('INFO  Sin EMAIL, PASSWORD y FIREBASE_API_KEY no se prueba la autenticación real.');
  }
} catch (error) {
  step(false, `error de red: ${error.message}`);
}
process.exit(failures ? 1 : 0);
