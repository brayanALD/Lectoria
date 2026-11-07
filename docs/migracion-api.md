# Migración a una API web (noviembre de 2026)

Estado (2026-11-07): **API desplegada en Render y verificada** (`https://lectoria-api-j30x.onrender.com`; ver §4). APK `preview`
compilado con EAS. **Pendiente: probar la app en un dispositivo contra la API y, solo entonces, publicar las reglas de solo lectura.**

## 1. Proyectos analizados

**Lectoria (este repositorio).** App Expo SDK 57 + TypeScript, React Navigation, Firebase Auth y Firestore. Hasta ahora no
tenía servidor: la app escribía directo en `users/{uid}/…` y Firestore validaba solo los campos con sus reglas. Toda la lógica
de negocio vivía en el teléfono: el progreso del libro respecto a sus sesiones (`planBookAfterSessionChange`), las fechas
de inicio y fin, el borrado en cascada, la búsqueda por ISBN con una clave de Google Books dentro de la app, etc.

**Jornada-Viva (proyecto de referencia).** App Expo SDK 58 con su propia API Express + Firebase Admin desplegada en Render,
ya migrada de la misma forma. No se copió código: se estudió su arquitectura y se tomaron las decisiones que encajan.

### Qué se reutilizó de Jornada-Viva

| Elemento | Cómo se adaptó |
|---|---|
| Patrón «la app lee de Firestore en tiempo real, escribe la API» con reglas de solo lectura al final | Igual. Conserva los listeners, el modo sin conexión de lectura y todas las pantallas |
| Express + Admin SDK, autenticación por ID token, `ctx` inyectable para probar sin red | Igual, en TypeScript. Sin roles: cada persona solo toca su `users/{uid}` |
| Formato de errores `{ error: { code, message, fields } }` y 503 para transitorios | Igual; el cliente los traduce a los códigos que ya entienden las pantallas (`getFirestoreErrorMessage`) |
| Idempotencia de las creaciones (`claveIdempotencia`) | `requestId` = id del documento; cambia si cambian los datos (`makeRequestId`). Arregla el aviso «puede haberse guardado igualmente» |
| `GET /v1/salud` y script de verificación del despliegue | `api/scripts/verify-deployment.mjs` (solo lectura) |
| Límite de uso, cabeceras de seguridad, `x-powered-by` fuera, límite de cuerpo | Límite por usuario (no por IP: detrás del proxy de Render serían todas la misma) |
| Disciplina de pruebas contra emulador, con la lógica real | 152 pruebas de la API + el extremo a extremo de la app (ver §6) |

**No se adoptó:** roles (Lectoria no los tiene), auditoría de acciones, cola de acciones sin conexión (ver propuestas),
tareas periódicas, planillas Excel, QR firmados.

## 2. Arquitectura

Ver el diagrama y los endpoints en [`api/README.md`](../api/README.md). Resumen de decisiones:

1. **Lecturas directas, escrituras por la API.** Reescribir las lecturas como REST habría perdido el tiempo real y obligado
   a rehacer la sincronización entre Inicio, Biblioteca, Calendario y Estadísticas (`ReadingDataProvider`), que es una de
   las garantías centrales de la app. Las reglas de seguridad pasan a «solo lectura»: el Admin SDK no pasa por ellas.
2. **Código compartido, no duplicado.** La API importa `src/utils` y `src/types`: la misma `planStatusChange`,
   `planBookAfterSessionChange`, `parseSessionForm`, `parseReviewForm`, `parseIsbn`… que ya tenían ~800 pruebas. Lo nuevo del
   servidor es solo lo que no puede estar en el cliente: leer los datos de Firestore, las transacciones y las validaciones
   estructurales.
3. **El servidor decide.** Ya no recibe «el libro» ni «la lista de sesiones» del teléfono: los lee él (en la transacción) y
   calcula las páginas leídas, el día de la sesión y el cambio del libro.
4. **Secretos fuera de la app.** La clave de Google Books (que iba dentro del APK) y el contacto de Open Library pasan a ser
   variables del servidor. La app solo conoce `EXPO_PUBLIC_API_URL`.

### Qué se movió al servidor y qué se queda en la app

| En la API | En la app (solo interfaz y experiencia) |
|---|---|
| Crear/editar/estado/compra/notas/reseña/eliminar libros, con cascada de sesiones | Formularios y su validación para dar el error al momento (`parseBookForm`, `parseSessionForm`…) |
| Sesiones: crear/editar/eliminar con el libro coherente en una transacción; terminar libro; ajustar progreso | Cronómetro y su borrador local; calendario, rachas y estadísticas (se derivan de los listeners) |
| Colecciones y estanterías (nombre único, libros existentes) | Filtros, búsqueda y orden de Biblioteca |
| Perfil, meta diaria, objetivo mensual | Pantallas de metas |
| Borrado de los datos de la cuenta (recursivo) | Reautenticación y borrado del usuario de Authentication |
| Búsqueda por ISBN con caché y respaldo | Escáner de código de barras, rellenado del formulario |

## 3. Cambios en la app móvil

- Nuevo `services/apiClientCore.ts` (cliente HTTP puro y probado) y `services/apiClient.ts` (añade el ID token). Los errores se
  traducen al vocabulario existente: ninguna pantalla distingue un error de la API de uno de Firestore.
- Los servicios `booksService`, `sessionsService`, `collectionsService`, `userService`, `accountService` y
  `bookCatalogService` conservan las suscripciones y cambian sus escrituras por llamadas a la API. **Cambian las firmas**:
  ya no reciben `uid`, `database`, `book` ni `sessions` (p. ej. `deleteSession(sessionId)`).
- Pantallas y hooks adaptados a las nuevas firmas; `AddBook`, `AddSession`, `CollectionForm` y `SaveShelfSheet` generan un
  `requestId` por intento (`utils/requestId.ts`).
- `useApiWarmUp`: mientras hay sesión y la app está abierta, avisa a la API (`GET /v1/salud`) al entrar, al volver a la app y
  cada 8 minutos, para que el plan gratuito de Render no la duerma.
- Mensajes nuevos para `lectoria/server-unavailable`, `lectoria/book-not-owned`, `invalid-argument`, etc.
- `.env.example`: nueva `EXPO_PUBLIC_API_URL`; salen `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`, `EXPO_PUBLIC_ANDROID_CERT_SHA1` y
  `EXPO_PUBLIC_OPENLIBRARY_CONTACT`.
- No se añadió ninguna dependencia a la app. La API tiene las suyas (`api/package.json`).

### Diferencias de comportamiento (aceptadas)

1. **Sin conexión no se puede guardar.** Antes Firestore ponía la escritura en cola y la aplicaba al volver la red; ahora la
   operación falla con «Sin conexión» y se repite a mano. Las lecturas siguen funcionando igual (con lo ya cargado). Ver propuesta 1.
2. **Un deseo no se lee.** Registrar lecturas, terminar o ajustar el progreso de un libro en la lista de deseos responde
   `409 BOOK_NOT_OWNED`. Antes solo lo impedía la interfaz.
3. **Una lectura de un día anterior exige la página inicial** también en el servidor (la interfaz ya lo pedía).
4. **Guardar dos veces la lectura del cronómetro** ya no se rechaza: la API reconoce el id y devuelve la sesión ya guardada.
5. **Reloj del teléfono:** se tolera un adelanto de hasta 5 minutos al comprobar que una fecha no es futura.
6. **Latencia:** cada escritura es una petición HTTP (decenas de ms con el servicio despierto). Con el plan gratuito, el primer
   arranque tarda 30–60 s si no se mantuvo despierto.
7. **Catálogo:** todas las consultas salen ahora de la misma IP del servidor (límite de Open Library: 1–3 por segundo), por
   eso la API recuerda los resultados (24 h si se encontró, 10 min si no) y limita las consultas por usuario.
8. **Google Books como respaldo queda desactivado** hasta que se cree una clave para el servidor (la anterior estaba
   restringida a la app Android y no sirve desde un servidor). No empeora el resultado que ya había: en la medición
   documentada en `docs/diagnostico-busqueda-isbn.md` no resolvía por ISBN.

## 4. Despliegue en Render

**Hecho (2026-11-07).** Servicio `lectoria-api` creado desde `render.yaml` (el nombre `lectoria-api` ya estaba ocupado por otro
servicio de Render, así que la URL lleva sufijo): **`https://lectoria-api-j30x.onrender.com`**. Variables en Render: `FIREBASE_PROJECT_ID`
y `FIREBASE_SERVICE_ACCOUNT` (clave de la cuenta de servicio de Firebase Admin, solo en Render; no está en el repositorio).

**Verificado contra producción:**

- `node api/scripts/verify-deployment.mjs` (con `API_URL`): salud 200, 401 sin token y con token falso.
- Recorrido autenticado con un usuario temporal de Firebase (creado y eliminado por el script de comprobación): `GET /v1/me`,
  perfil, meta, libro (la repetición con el mismo `requestId` no duplica), sesión (el libro avanzó en la misma transacción),
  catálogo por ISBN, validación 400 y `DELETE /v1/me/data`. Sin restos en Firestore ni en Authentication.

**Cómo se usa en la app:** `EXPO_PUBLIC_API_URL` en `.env` (desarrollo: `npx expo start -c`) y en el entorno `preview` de EAS.

**Compilación:** perfil `preview` de `eas.json` (APK independiente, JS y variables incluidas):
`npx eas-cli build --platform android --profile preview`. Las variables `EXPO_PUBLIC_*` y `GOOGLE_SERVICES_JSON` del entorno
`preview` de EAS se crearon a partir del `.env` local. El keystore es el mismo de las builds de desarrollo, así que el acceso con
Google sigue registrado.

**Falta:** probar en un dispositivo (alta de libro, lectura, cronómetro, colección, meta, escáner, borrar cuenta) y **solo después**
publicar las reglas de solo lectura:
   ```bash
   npx firebase-tools deploy --only firestore:rules --config firebase.api.json
   ```
   (no con `firebase.json`, que carga las reglas anteriores). Tras publicarlas, una versión antigua de la app que escribe
   directo en Firestore dejaría de poder guardar.

### Recuperación

| Situación | Acción |
|---|---|
| La API se cae o se despliega mal | *Rollback* desde Render (despliegue anterior). Los datos no cambian de formato: no hay nada que revertir. Mientras tanto la app lee, pero no escribe |
| Hay que volver a la escritura directa | Mientras no se publiquen `firestore.api.rules`, las reglas anteriores siguen vigentes. Si ya se publicaron: `npx firebase-tools deploy --only firestore` (carga `firestore.rules`) y volver al commit anterior de la app |
| Se filtró la clave de servicio | Revocarla en Firebase/Google Cloud, generar otra y actualizar `FIREBASE_SERVICE_ACCOUNT` en Render |

## 5. Seguridad

- La clave de servicio solo vive en Render. La app no contiene ninguna credencial nueva (se retiró la de Google Books).
- Cada solicitud se autentica con el ID token de Firebase; el `uid` nunca viene del cliente.
- Con las reglas de solo lectura, ni siquiera un cliente modificado puede escribir en Firestore.
- Entradas validadas con límites explícitos (cuerpos ≤ 100 kB, listas y textos acotados), identificadores restringidos a
  `[A-Za-z0-9_-]{1,128}`, 120 solicitudes/minuto por usuario, cabeceras `nosniff` y `no-store`.
- `npm audit` (API, producción) reporta 8 avisos moderados **transitivos de `firebase-admin`** (módulos de Storage que no se
  usan). La corrección propuesta por npm es bajar de versión; no se aplicó.

## 6. Pruebas (ejecutadas el 2026-11-07)

| Comando | Resultado |
|---|---|
| `npm test` (Jest, app) | **837 / 837** (incluye cliente HTTP, idempotencia y contrato de los servicios con la API) |
| `npm run typecheck` y `npm run typecheck:api` | sin errores |
| `npm run test:api` (API real + emulador de Firestore) | **152 / 152** |
| `npm run test:rules` (extremo a extremo + reglas) | **123 / 123**: la app (servicios reales) → HTTP → API → Firestore → suscripciones, con las reglas de solo lectura |
| `npx expo export --platform android` | bundle de Android compilado (Hermes) |
| Simulación del build de Render en una copia limpia (`npm ci` + `build` + arranque) | correcta |

Las pruebas por servicio de `tests/rules` (libros, sesiones, colecciones, usuario, cuenta) se sustituyeron por las de la API,
que cubren los mismos escenarios (y los de aislamiento entre usuarios) a través del contrato HTTP; `dataSync` se mantiene y ahora
escribe por la API real.

**Verificado en producción (2026-11-07):** el servicio en Render y la autenticación con un ID token real contra el Admin SDK (§4).
**No verificado todavía:** el arranque en frío tras dormirse el servicio y la app en un dispositivo contra la API pública.

## 7. Problemas conocidos y pendientes

- Falta la prueba en dispositivo y publicar las reglas de solo lectura (arriba).
- Clave de la cuenta de servicio: la copia de trabajo se creó con `gcloud` y debe borrarse del equipo; la de Render se revoca/rota desde Firebase si hace falta.
- Escrituras sin conexión (diferencia 1).
- Open Library comparte IP para todos los usuarios (diferencia 7).
- El límite de uso es en memoria (válido con una sola instancia).

## 8. Propuestas — pendientes de tu aprobación (no implementadas)

1. **Cola de acciones sin conexión** (guardar libros/lecturas sin red y enviarlas al volver, como en Jornada-Viva). *Utilidad:*
   recupera lo que se pierde en la diferencia 1; los `requestId` ya hacen seguro el reenvío. *Coste:* medio.
2. **Clave de Google Books propia del servidor** restringida solo a «Books API», para reactivar el respaldo del catálogo.
   *Utilidad:* más ISBN resueltos. *Coste:* bajo (crear la clave y ponerla en Render).
3. **Borrar el usuario de Authentication desde la API** (hoy lo hace la app tras reautenticar). *Utilidad:* un solo paso
   atómico para el borrado de cuenta, sin `requires-recent-login`. *Contra:* hay que conservar la reautenticación como prueba de identidad.
4. **Exportación de datos** (prevista para la 1.5) como `GET /v1/me/export`. *Utilidad:* cumplimiento y portabilidad.
5. **Recordatorios por notificación push** (versión 1.4) enviados desde el servidor. *Requiere* un servicio programado: el
   plan gratuito no lo permite sin un *cron job* de Render.
6. **Documento OpenAPI** de los endpoints. *Utilidad:* contrato verificable y cliente generado.
