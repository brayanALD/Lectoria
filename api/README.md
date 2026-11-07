# API de Lectoria

Servidor Node.js + Express con la lógica de negocio de la app: libros, sesiones de lectura (y el progreso que de ellas
se deriva), colecciones, metas, borrado de cuenta y búsqueda por ISBN. Escribe en Firestore con el Admin SDK; la app
móvil **lee** de Firestore en tiempo real y **escribe** aquí. Decisiones y detalle de la migración:
[`docs/migracion-api.md`](../docs/migracion-api.md).

```bash
cd api
npm install
cp .env.example .env     # completa FIREBASE_PROJECT_ID y FIREBASE_SERVICE_ACCOUNT
npm run dev              # http://localhost:8080/v1/salud   (tsx, recarga al reiniciar)
npm run build && npm start   # el mismo bundle que se despliega
```

## Arquitectura

```text
app móvil ──(ID token de Firebase)──▶ API (Express) ──(Admin SDK)──▶ Firestore users/{uid}/…
    ▲                                                                       │
    └────────────── listeners en tiempo real (reglas de solo lectura) ◀─────┘
```

- **Una carpeta, un bundle.** La API importa `src/utils` y `src/types` de la app (las mismas funciones puras que usa el
  formulario: `planStatusChange`, `planBookAfterSessionChange`, `parseSessionForm`, `parseReviewForm`, ISBN…). No hay dos
  copias de la lógica que puedan divergir. `esbuild` lo empaqueta todo en `api/dist/server.cjs`.
- **El servidor no se fía del cliente.** El `uid` sale del token, nunca del cuerpo; las rutas de los documentos se
  construyen con él, así que nadie puede tocar la biblioteca de otra persona (responde 404). El servidor vuelve a
  validar todo, **lee él mismo** el libro y las demás sesiones (no recibe copias del cliente) y calcula lo derivado:
  páginas leídas, día de la sesión y el cambio de estado/progreso del libro.
- **Atomicidad.** Registrar, editar o eliminar una sesión y mover el libro ocurre en **una transacción**: el progreso del
  libro nunca queda desfasado de sus sesiones.
- **Idempotencia.** Las creaciones aceptan `requestId` (`[A-Za-z0-9_-]{8,100}`), que se usa como id del documento: repetir
  una petición (corte de red, tiempo agotado) devuelve `200 { id, repeated: true }` en lugar de duplicar. El cronómetro usa
  `timer-<inicio>`. Eliminar es idempotente (borrar lo que no existe devuelve éxito).
- **Errores.** Siempre `{ "error": { "code", "message", "fields"? } }`. Los inesperados no filtran detalles; los
  transitorios de Firestore responden `503 BUSY` para que el cliente reintente.
- **Límite de uso.** 120 solicitudes por minuto y por usuario (`RATE_LIMIT_PER_MINUTE`), en memoria (una sola instancia).

## Endpoints (`/v1`)

Todos, salvo la salud, exigen `Authorization: Bearer <ID token de Firebase Auth>`. Los cuerpos son JSON; las fechas, ISO 8601.

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /v1/salud` | Salud (sin sesión). También sirve para despertar el servicio | `200 { status: "ok" }` |
| `GET /v1/me` | Comprueba la sesión | `200 { uid }` |
| `POST /v1/me/profile` | Crea el perfil si no existe (`displayName?`, `nickname?`, `timeZone`) | `201/200 { created }` |
| `PUT /v1/me/daily-goal` · `DELETE` | Meta diaria `{ type: "minutes"\|"pages", target }` | `204` |
| `PUT /v1/me/monthly-goal` · `DELETE` | Objetivo mensual `{ target }` (1–1000) | `204` |
| `DELETE /v1/me/data` | Borra todos los datos de la cuenta (recursivo) | `204` |
| `GET /v1/catalog/isbn/:isbn` | Busca por ISBN-10/13 en Open Library (+ Google Books si hay clave) | `200 { book \| null }` |
| `POST /v1/books` | Crea un libro o deseo (`requestId?`, `title`, `authors[]`, `pageCount?`, `genres?`, `seriesName?`, `seriesOrder?`, `isbn13?`, `coverUrl?`, `status?`, `acquisition?`) | `201/200 { id, repeated }` |
| `PATCH /v1/books/:id` | Edita los datos del libro (lo omitido se elimina) | `204` |
| `PUT /v1/books/:id/status` | Cambia el estado (no admite `finished`) | `204` |
| `POST /v1/books/:id/finish` | Termina el libro y registra las páginas que faltaban (`timeZone`) | `204` |
| `POST /v1/books/:id/progress` | Ajusta la página a mano (`page`, `timeZone`) | `204` |
| `PUT /v1/books/:id/purchase` | Marca como comprado (`purchasedAt`, `price?`) | `204` |
| `PUT /v1/books/:id/notes` | Notas (`notes`; vacío = se eliminan) | `204` |
| `PUT /v1/books/:id/review` | Reseña (`rating?`, `review?`, `specificReviews?[≤5]`) | `204` |
| `DELETE /v1/books/:id` | Elimina el libro y sus sesiones | `200 { deletedSessions }` |
| `POST /v1/sessions` | Registra una lectura (`requestId?`, `bookId`, `date`, `timeZone`, `durationMinutes?`, `startPage?`, `endPage?`, `notes?`) | `201/200 { id, repeated }` |
| `PUT /v1/sessions/:id` | Edita una lectura (misma forma, sin `bookId`; `dateKey?` conserva el día) | `204` |
| `DELETE /v1/sessions/:id` | Elimina una lectura y deja el libro coherente | `204` |
| `POST /v1/collections` | Crea una colección `manual` (`bookIds`) o una estantería `filter` (`filters`) | `201/200 { id, repeated }` |
| `PATCH /v1/collections/:id` | Cambia el nombre y, en una manual, sus libros | `204` |
| `DELETE /v1/collections/:id` | Elimina la colección | `204` |

Códigos: `400 VALIDATION` (con `fields`), `401 UNAUTHENTICATED`, `404 NOT_FOUND`, `409 BOOK_NOT_OWNED` (un deseo no se
lee: primero se marca como comprado), `429 RATE_LIMITED` / `CATALOG_RATE_LIMITED`, `502 CATALOG_UNAVAILABLE`,
`503 BUSY`, `500 INTERNAL`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Sí | Id del proyecto de Firebase |
| `FIREBASE_SERVICE_ACCOUNT` | Sí en producción | Clave de la cuenta de servicio: JSON en una línea o en base64. **Secreto del servidor** |
| `PORT` | No | Lo fija Render (por defecto 8080) |
| `RATE_LIMIT_PER_MINUTE` | No | Por defecto 120 |
| `OPENLIBRARY_CONTACT` | No | Contacto para el `User-Agent` de Open Library (3 peticiones/s en lugar de 1) |
| `GOOGLE_BOOKS_API_KEY` | No | Respaldo del catálogo. Clave restringida a «Books API». Sin ella solo se usa Open Library |
| `CORS_ORIGINS` | No | Vacío: la app móvil no usa CORS |
| `FIRESTORE_EMULATOR_HOST` | Solo pruebas | Apunta al emulador |

Nada de esto va en el repositorio ni en la app. La app solo conoce `EXPO_PUBLIC_API_URL` (una dirección pública).

## Pruebas

Desde la raíz del repositorio (necesitan Java para el emulador de Firestore):

```bash
npm run test:api        # 152 pruebas: API real contra el emulador (autenticación, libros, sesiones, colecciones, catálogo…)
npm run typecheck:api
npm run test:rules      # extremo a extremo: servicios de la app → HTTP → API → Firestore → suscripciones, y reglas
```

## Despliegue en Render

`render.yaml` (en la raíz) describe el servicio. Pasos y comprobaciones en
[`docs/migracion-api.md`](../docs/migracion-api.md#4-despliegue-en-render). Una vez desplegada:

```bash
API_URL=https://<tu-servicio>.onrender.com node api/scripts/verify-deployment.mjs
# con EMAIL, PASSWORD y FIREBASE_API_KEY (de una cuenta de prueba) comprueba también la autenticación real
```

**Plan gratuito:** el servicio se duerme tras ~15 min sin tráfico y el primer arranque tarda 30–60 s. La app lo mantiene
despierto mientras está abierta (`useApiWarmUp`). Para un servicio siempre activo, cambiar `plan: free` por `starter`.
