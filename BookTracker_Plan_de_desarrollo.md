# Lectoria — Plan de desarrollo de la aplicación móvil

> Estado: **Versión 1.0 cerrada el 2026-10-13** (Fases 1 a 5). **Fase 5 (estadísticas) cerrada el 2026-10-13** (pestaña Estadísticas con vistas Día y Mes y meta diaria integrada). **Fase 4 (sesiones) cerrada el 2026-10-13** (registro de lecturas manual y con cronómetro, progreso sincronizado, calendario, rachas y meta diaria; probada en Android por el usuario). Siguiente: versión 1.1 (Fase 6). **Fase 3 (ISBN) cerrada el 2026-10-13** (búsqueda por ISBN con Open Library, escáner con `expo-camera`, duplicados). **Fase 2 (biblioteca) cerrada el 2026-10-13.** **Fase 1 cerrada para Android (2026-10-12)**: Expo SDK 57 + TypeScript, autenticación con correo y Google (con nombre, apodo y vinculación de métodos), navegación condicional, tema, logo e iconos, Firestore en `us-east1` con reglas desplegadas. Verificado en dispositivo: registro, login, sesión persistente, cierre de sesión, perfil `users/{uid}` y vinculación. Siguiente: Fase 2 (biblioteca). Fuera del cierre: iOS (requiere cuenta de Apple Developer), ESLint y tema oscuro.
> Nota de nombre: este archivo conserva el nombre `BookTracker_Plan_de_desarrollo.md` por compatibilidad con referencias existentes. «BookTracker» es el tipo de app; el nombre del producto es **Lectoria**.

Leyenda de estado usada en todo el documento:

- **[Confirmado]**: decisión tomada, parte de la plantilla o del plan original.
- **[Recomendado]**: propuesta razonada, aplicable salvo que se decida otra cosa.
- **[Pendiente]**: requiere definición posterior; no se debe asumir.

---

## 1. Visión, objetivos y alcance

Lectoria (*lectura* + *trayectoria*) es una aplicación móvil de seguimiento de lectura con identidad visual propia, pensada también como proyecto de portafolio. Prioriza una experiencia móvil intuitiva, una interfaz coherente y una arquitectura mantenible que crezca por versiones.

Dos áreas principales:

- **Mi biblioteca:** libros, autores, sagas, colecciones, listas y valoraciones.
- **Mi experiencia lectora:** sesiones, calendario, progreso, rachas y logros.

**Alcance de la primera versión:** personal y multiusuario; cada lector tiene su biblioteca privada. Las funciones sociales (reseñas públicas, compartir) quedan **fuera de alcance** hasta después de la 1.5.

**Usuarios objetivo y necesidades:** lectores que quieren (1) saber qué tienen y qué han leído, (2) registrar cuánto leen sin fricción, (3) mantener el hábito (rachas, objetivos) y (4) ver su evolución. [Recomendado] Validar estas necesidades con pruebas informales con 3–5 lectores antes de la 1.1.

## 2. Stack tecnológico

Basado en la plantilla reutilizable para apps móviles.

| Capa | Tecnología | Estado |
|---|---|---|
| Framework | Expo (React Native) | [Confirmado] |
| Lenguaje | **TypeScript** (la plantilla lo recomienda para proyectos nuevos; el plan ya usa tipos) | [Confirmado] |
| Navegación | React Navigation: `native-stack` + `bottom-tabs` (las pestañas no figuran en la plantilla; se añaden por el requisito de 5 destinos) | [Confirmado] |
| Backend | Firebase Auth (email/contraseña **y Google**) + Firestore | [Confirmado] |
| Acceso con Google | `@react-native-google-signin/google-signin` ^16 + `expo-dev-client`; exige **development build** con EAS Build (no funciona en Expo Go). Identificador de app `com.lectoria.app` (Android e iOS) | [Confirmado] (2026-10-12) |
| Estado global | Context API (`AuthContext`) | [Confirmado] |
| Almacenamiento local | AsyncStorage (sesión y preferencias) | [Confirmado] |
| Fechas | dayjs | [Confirmado] |
| Iconos | `@expo/vector-icons` | [Confirmado] |
| Layout seguro | `react-native-safe-area-context` | [Confirmado] |
| Cámara / ISBN | `expo-camera` (verificar compatibilidad con la versión de Expo elegida) | [Recomendado] |
| Notificaciones locales | `expo-notifications` (versión 1.4; verificar limitaciones) | [Recomendado] |
| Proveedor bibliográfico | **Open Library** (API `api/books`, sin clave), detrás de `bookCatalogService` | [Confirmado] (2026-10-13, Fase 3) |
| Pruebas | Jest (`jest-expo`) para `utils`; emulador de Firestore + `@firebase/rules-unit-testing` para reglas | [Confirmado] (2026-10-12, Fase 1) |
| Versión de Expo / SDK | **SDK 57** (`expo ~57.0.28`, React Native 0.86.3, React 19.2.3, TypeScript ~6.0). `firebase` 13 (Expo exige ≥ 12). React Navigation 7. Siempre instalar con `npx expo install` | [Confirmado] (2026-10-12, Fase 1) |

**Notas de adaptación respecto a la plantilla**

- La plantilla advierte de una discrepancia de versión de Expo entre `package.json` (~57) y `AGENTS.md` (v54) **en otro proyecto**. En Lectoria se evita fijando una sola versión al hacer el scaffold y documentándola en `CLAUDE.md`.
- `create-expo-app@latest` puede generar una plantilla con Expo Router. Lectoria usa **React Navigation** (plantilla); usar la plantilla `blank-typescript` y no mezclar ambos sistemas de navegación.
- La plantilla usa JavaScript en sus ejemplos (`.js`); aquí se aplican las mismas rutas con extensión `.ts/.tsx`.

## 3. Alcance por versiones y dependencias

### MVP (versión 1.0)

Debe permitir registrar libros, leer, medir el progreso y consultar la biblioteca de forma fiable.

| Módulo | Contenido |
|---|---|
| 1. Biblioteca personal | Añadir libros (manual o ISBN), editar, eliminar, buscar y filtrar, cambiar estado de lectura |
| 2. Seguimiento | Registrar sesiones (páginas, duración, fecha) y ver el progreso del libro |
| 3. Calendario y rachas | Días de lectura, tiempo acumulado, racha actual y máxima |
| 4. Estadísticas básicas | Libros terminados, páginas y minutos por día y por mes, y objetivo diario. **El objetivo mensual en libros se aplazó a la 1.1** (decisión al cerrar la 1.0, 2026-10-13) |
| Base | Registro/login, navegación condicional por sesión, tema, reglas de Firestore |

### Versiones posteriores

| Versión | Funciones | Depende de |
|---|---|---|
| 1.1 | Lista de deseos, libros comprados, notas y reseñas | Biblioteca (1.0) |
| 1.2 | Autores, sagas, colecciones personalizadas, estanterías filtradas | Biblioteca con campos de género y saga (1.0) |
| 1.3 | Ruleta de no leídos, logros, estantería realista | Libros terminados, sesiones, rachas (1.0); sagas (1.2) para el logro de saga |
| 1.4 | Recordatorios locales, calendario avanzado, estimaciones de lectura | Sesiones (1.0) |
| 1.5 | Estadísticas ampliadas, exportación de datos, accesibilidad | Todo lo anterior |

Se puede adelantar una función si es clave para la presentación, pero la biblioteca y el registro de sesiones son el núcleo.

### Dependencias funcionales clave

`Auth → Biblioteca → Sesiones → (Calendario, Rachas, Estadísticas) → (Logros, Estantería)`. El escaneo ISBN depende del servicio de catálogo y de la entrada manual (esta última es siempre el respaldo).

## 4. Navegación y pantallas

Cinco destinos en la barra inferior; formularios, detalles y ajustes se abren encima (stack). Raíz: `AuthProvider > NavigationContainer > navigator`; `AppNavigator` muestra el stack de autenticación o el de la app según la sesión.

| Pestaña | Contenido |
|---|---|
| **Inicio** | Saludo y resumen, libros en lectura, acceso rápido a registrar sesión, racha y objetivo diario, actividad reciente |
| **Biblioteca** | Cuadrícula/lista, filtros (estado, género, autor, saga), acciones de añadir/editar/eliminar/cambiar estado |
| **Calendario** | Vista mensual con indicadores, detalle de sesiones por día, totales diarios |
| **Estadísticas** | Resumen mensual/anual, libros, páginas y horas, géneros y autores, rachas y objetivos |
| **Mi espacio** | Perfil, objetivos, preferencias, lista de deseos (1.1), colecciones y sagas (1.2), logros y estantería (1.3), notificaciones, ajustes, cerrar sesión |

Pantallas secundarias: Login/Registro, Añadir libro (manual/ISBN), Escáner, Detalle del libro, Registrar lectura, y — en versiones posteriores — Crear colección, Detalle de saga, Detalle de autor, Ruleta, Logros, Estantería, Ajustes.

Patrones de UI (plantilla): lista + card reutilizable + detalle por id; filtros combinables en un componente aparte con normalización de texto (sin tildes, minúsculas); estados de carga, vacío y error siempre explícitos.

## 5. Sistema visual y paleta

Paleta oficial (archivo original copiado a `docs/palette-original.txt`). **No se modifican estos valores.**

| Nombre | Hex | RGB | HSL |
|---|---|---|---|
| Evergreen | `#14281D` | 20, 40, 29 | 147, 33, 12 |
| Hunter Green | `#355834` | 53, 88, 52 | 118, 26, 27 |
| Olive Bark | `#6E633D` | 110, 99, 61 | 47, 29, 34 |
| Soft Fawn | `#C2A878` | 194, 168, 120 | 39, 38, 62 |
| Porcelain | `#F1F5F2` | 241, 245, 242 | 135, 17, 95 |

### Uso previsto (tokens semánticos, tema claro) [Recomendado]

| Token | Color | Uso |
|---|---|---|
| `background` | Porcelain | Fondo de pantallas |
| `surface` | Porcelain + borde (ver abajo) | Cards, hojas, inputs |
| `textPrimary` | Evergreen | Títulos y texto principal |
| `textSecondary` | Olive Bark | Texto de apoyo, metadatos |
| `primary` | Hunter Green | Botones principales, pestaña activa, progreso, enlaces |
| `onPrimary` | Porcelain | Texto/icono sobre `primary` |
| `accent` | Soft Fawn | Resaltados, rachas, logros, insignias, fondos suaves |
| `onAccent` | Evergreen | Texto sobre `accent` |
| `border` | Evergreen al 12 % de opacidad | Divisores y bordes **decorativos** (tarjetas, barra de progreso, siluetas de carga); contraste bajo a propósito |
| `outline` | Olive Bark | Borde de **controles** (campos, buscador, etiquetas, botón de Google): 5,43:1 sobre Porcelain, cumple el 3:1 de WCAG 1.4.11 |
| `overlay` | Evergreen al 50 % | Fondo atenuado tras hojas modales |
| `pressed` | `primary` al 85 % de opacidad | Estado presionado del botón primario; el resto de controles bajan su opacidad (`opacity.pressed`) |
| (deshabilitado) | opacidad `opacity.disabled` (0,5) | Elementos deshabilitados; no hay un color propio |
| `success` | Hunter Green | Confirmaciones, objetivo cumplido |
| `warning` | Soft Fawn | Avisos |
| `error` | **#B3261E** (complementario) | Errores y acciones destructivas |

**Principios de diseño [Confirmado, 2026-10-13]**, obligatorios en código nuevo y existente (detalle y reglas en `CLAUDE.md`):

1. **Skeletons de carga:** siluetas con la forma del contenido final en lugar de pantallas en blanco o spinners de pantalla completa.
2. **Ley de Hick:** una acción principal por pantalla; sin títulos, subtítulos ni párrafos de ayuda superfluos.
3. **Design tokens estrictos:** ningún color ni valor de diseño escrito fuera de `src/theme/`; una prueba automática lo vigila.
4. **Accesibilidad:** contraste de texto ≥ 4,5:1 y de controles ≥ 3:1, zonas táctiles ≥ 48 pt, roles y nombres accesibles, «reducir movimiento» y escalado de texto.

**Tema oscuro** [Confirmado e implementado, 2026-10-14]: sigue al tema del sistema al abrir la app. `background` = Evergreen, `textPrimary` = Porcelain, `textSecondary` = Soft Fawn (6,78:1), `accent` = Soft Fawn, `primary` = Hunter Green aclarado hacia Porcelain (mezcla derivada de la paleta; Hunter Green puro sobre Evergreen solo da 1,92:1) y error `#F0A19B`. El logo y el botón de Google conservan un fondo claro. Contrastes verificados en `colors.test.ts`. Pendiente: conmutador dentro de la app y cambio en vivo; requiere un build nuevo de EAS (`userInterfaceStyle`).

### Colores complementarios (únicamente indispensables)

La paleta no define un color de error. Se propone `#B3261E` (claro) y `#F0A19B` (oscuro). Éxito y aviso reutilizan colores de la paleta; bordes, presionado y deshabilitado se obtienen con opacidad, sin añadir colores.

### Contrastes (WCAG 2.x, calculados con los valores exactos)

| Combinación | Ratio | Uso permitido |
|---|---|---|
| Evergreen / Porcelain | 14,13:1 | Cualquier texto |
| Hunter Green / Porcelain | 7,35:1 | Cualquier texto y botones |
| Olive Bark / Porcelain | 5,43:1 | Texto (≥ AA) |
| Soft Fawn / Evergreen | 6,78:1 | Texto sobre fondo oscuro |
| Evergreen / Soft Fawn | 6,78:1 | Texto sobre `accent` |
| `#B3261E` / Porcelain | 5,94:1 | Texto de error |
| **Soft Fawn / Porcelain** | **2,08:1** | **No usar para texto ni iconos informativos sobre fondo claro** |
| Hunter Green / Evergreen | 1,92:1 | No usar juntos |

Regla: los tokens se centralizan en `src/theme/colors.ts`; nunca se escriben colores sueltos en componentes.

## 6. Modelo de datos (Firestore)

Principio: el libro **personal** es la unidad de trabajo. Cada usuario guarda sus propios metadatos del libro.

```text
users/{uid}                      Perfil: displayName (obligatorio al crear), nickname (opcional), zona horaria, objetivos (diario/mensual)
users/{uid}/books/{bookId}       Biblioteca personal (incluye lista de deseos: acquisition = "wishlist")
users/{uid}/sessions/{sessionId} Historial de sesiones
users/{uid}/collections/{id}     Colecciones personalizadas (versión 1.2)
users/{uid}/reminders/{id}       Recordatorios (versión 1.4, solo si se necesitan en la nube)
```

### Modelo de libro personal

```ts
type ReadingStatus = "want_to_read" | "reading" | "paused" | "finished" | "abandoned";
type Acquisition = "wishlist" | "owned";

interface UserBook {
  title: string;
  authors: string[];
  genres?: string[];
  seriesName?: string;
  seriesOrder?: number;
  isbn13?: string;
  coverUrl?: string;
  pageCount?: number;

  status: ReadingStatus;
  acquisition: Acquisition;   // sustituye a `isPurchased`; "wishlist" = deseado, aún sin tener
  currentPage: number;
  rating?: 1 | 2 | 3 | 4 | 5;
  review?: string;
  notes?: string;

  startedAt?: Timestamp;
  finishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Modelo de sesión

```ts
interface ReadingSession {
  bookId: string;
  date: Timestamp;          // instante de la sesión
  dateKey: string;          // "YYYY-MM-DD" en la zona horaria del usuario; base de rachas y calendario
  startPage?: number;
  endPage?: number;
  pagesRead: number;        // calculado/validado desde startPage y endPage cuando existan
  durationMinutes: number;
  notes?: string;
  createdAt: Timestamp;
}
```

### Reglas de integridad [Recomendado]

- **Fuente de verdad del progreso:** las estadísticas (páginas, minutos, rachas) se calculan **solo desde las sesiones**. `currentPage` es un valor almacenado que se actualiza a `endPage` en la misma operación en lote (`writeBatch`) que crea la sesión, y puede ajustarse manualmente. Crear, editar y eliminar una sesión mantienen `currentPage` coherente en la misma operación atómica (ver «Sincronización» en la sección 9).
- Una sesión se cuenta una sola vez; borrar un libro exige decidir el destino de sus sesiones (por defecto: confirmar y eliminarlas en lote).
- Pausar o abandonar no elimina sesiones. Comprar un libro no implica empezarlo.
- Un libro de la lista de deseos pasa a la biblioteca cambiando `acquisition`, sin duplicarse.
- **Rating:** enteros de 1 a 5.
- Fechas como `Timestamp` (plantilla), más `dateKey` para agrupar por día sin errores de zona horaria.
- Referencias a datos eliminados (lección de la plantilla): planificarlas desde el inicio; las colecciones (1.2) deben tolerar `bookIds` que ya no existen.

### Decisiones sobre el diseño original

- **Catálogo compartido `catalogBooks` aplazado.** Exigía un backend confiable para escribirlo (Cloud Functions), contradiciendo «sin servidor propio» de la plantilla. En 1.0 los metadatos se guardan en el libro personal. [Pendiente] reconsiderarlo solo si hay una necesidad medida.
- **Autores y sagas** en 1.0–1.1: campos del libro (`authors`, `seriesName`, `seriesOrder`) y vistas derivadas. Entidades propias (`authors/`, `series/`) quedan [Pendiente] hasta 1.2.
- **Lista de deseos y compras**: integradas en `books` con `acquisition`; se eliminan las colecciones `wishlist` y `purchases`. Precio y fecha de compra son [Pendiente].
- **Objetivos**: dentro de `users/{uid}`. Mínimo: objetivo mensual en **número de libros** y objetivo diario, que se mide en **minutos o en páginas** a elección de la persona [Confirmado, 2026-10-13]: `dailyGoalMinutes` (1–1440) o `dailyGoalPages` (1–10000), nunca los dos a la vez (lo exigen las reglas). Otras unidades y objetivos anuales [Pendiente].
- **Resúmenes `statsMonthly`**: no en 1.0; se calculan en el cliente desde las sesiones. Se evaluará una caché cuando el volumen lo justifique.
- **Logros**: se derivan de los datos del usuario y se calculan en el cliente. Como la biblioteca es privada, no hay motivo para validarlos en un backend; se descarta la colección `achievements` como fuente de verdad (puede guardarse solo la fecha de desbloqueo).

## 7. Seguridad y privacidad

Las reglas de Firestore deben impedir que un usuario lea o modifique datos de otro; ocultar pantallas no es suficiente.

Las reglas viven en `firestore.rules` (fuente de verdad; no se duplican aquí). Estado tras la Fase 1:

- Acceso solo del propietario a `users/{uid}`, `books` y `sessions`; el resto de rutas está denegado. Cada colección nueva se añade de forma explícita.
- Validación de campos, tipos y límites en perfil, libros y sesiones (campos desconocidos rechazados, `rating` 1–5, páginas y duraciones acotadas, `dateKey` con formato `YYYY-MM-DD`, sesión con páginas o minutos > 0).
- `createdAt` y `updatedAt` los fija el servidor: **el cliente debe escribirlos con `serverTimestamp()`**; `createdAt` no puede modificarse.
- Verificadas con 13 pruebas en el emulador de Firestore (`npm run test:rules`, sección 13).

**Requisitos antes de usar con usuarios reales** (Fase 7):

1. Ampliar las pruebas de reglas a medida que se añadan colecciones (colecciones, recordatorios) y revisar límites de tamaño.
2. Nunca dejar Firestore en modo de prueba abierto (plantilla).
3. Desplegar las reglas al proyecto de Firebase real (`firebase deploy --only firestore:rules`; no ejecutado todavía).
4. Claves de Firebase en variables `EXPO_PUBLIC_*` dentro de `.env` fuera de git; las claves de Firebase para cliente no son secretos por sí mismas, pero la seguridad real depende de las reglas. No incluir claves privadas ni cuentas de servicio en el repositorio.

**Auditoría de exposición (2026-10-12):** el repositorio es público y `google-services.json` (con una clave de API de Firebase) estaba versionado y subido. Resultado del escaneo del historial: no hay claves privadas, cuentas de servicio, tokens ni secretos de cliente OAuth; solo esa clave de API. Se comprobó que ninguna de las dos claves de Firebase (la de `google-services.json` y la web de `.env`) tenía restricción de aplicación. Acciones: archivos de configuración nativa fuera de git y entregados a EAS como variables de tipo archivo; claves restringidas en Google Cloud (**aplicado y verificado el 2026-10-13**): la clave de Android solo acepta la app `com.lectoria.app` con la SHA-1 del keystore de EAS (las peticiones externas devuelven `API_KEY_ANDROID_APP_BLOCKED`), y la clave del navegador, usada por el SDK de JavaScript, solo permite Identity Toolkit, Token Service y Cloud Firestore (las demás APIs devuelven `API_KEY_SERVICE_BLOCKED`). La clave sigue en el historial de git, por lo que la restricción es la defensa real, no el borrado. **Pendiente al publicar en Play Store:** añadir a la clave de Android la SHA-1 de la firma de Play App Signing y la de cualquier keystore nuevo.

**Privacidad** [Recomendado]: reseñas y notas privadas por defecto; exportación de datos (1.5); **eliminación de cuenta**: Firestore no borra subcolecciones al eliminar el documento padre, por lo que el borrado completo requiere eliminar `books` y `sessions` desde la app (o una función en backend) además de `deleteUser`. Las tiendas de aplicaciones suelen exigir poder eliminar la cuenta desde la app [Pendiente: verificar requisitos vigentes antes de publicar].

## 8. Alta de libros: ISBN y entrada manual

**Método A — escaneo:** abrir cámara → detectar EAN-13 → validar ISBN-13 (aceptar y normalizar ISBN-10) → consultar proveedor → mostrar metadatos → confirmar/corregir → guardar.

**Método B — manual:** título, autor, páginas, género, etc. Es el respaldo obligatorio si no hay resultado o código legible.

Arquitectura:

- `expo-camera` ~57 para lectura, **añadido el 2026-10-13** (módulo nativo: la app de desarrollo instalada necesita un build nuevo de EAS; en Expo Go ya funciona, comprobado). Solo se pide el permiso de **cámara** (con texto en español); el micrófono se desactiva. Solo se leen códigos `ean13`; el ISBN se valida con su dígito de control y un código que no empieza por 978/979 se descarta con el aviso «Ese código no es de un libro».
- `src/services/bookCatalogService.ts`: interfaz común «buscar por ISBN»; el escáner no conoce al proveedor.
- Proveedor [Confirmado, 2026-10-13]: **Open Library**. Se descartó Google Books porque no se pudo confirmar que fuera gratuito: su documentación y sus condiciones de uso no mencionan precio ni cuota, exigen una clave de API (que quedaría dentro de la app) y prohíben cobrar a los usuarios por usar la aplicación. Open Library no necesita clave ni facturación; su política pide identificar la app con un `User-Agent` (opcional `EXPO_PUBLIC_OPENLIBRARY_CONTACT`), no superar 1 petición por segundo (3 si se identifica) y no usarla como servidor de un servicio comercial de mucho tráfico. Se consulta solo al pulsar «Buscar» (una petición por ISBN y teléfono). **Riesgo:** una app comercial con mucho tráfico incumpliría su política; en ese caso habría que cambiar de proveedor (solo cambia `bookCatalogService.ts`).
- Datos del catálogo: se aprovechan título (con subtítulo), autores, páginas y portada. **No se importan los géneros**: los «temas» de Open Library son ruidosos (comprobado con un libro real devuelto con temas ajenos). La calidad de los datos es irregular, por eso siempre se pueden corregir en el formulario antes de guardar.
- Un ISBN no encontrado llega como `{}` con HTTP 200 (comprobado); el formulario lo indica y deja rellenar a mano.
- Duplicados: antes de guardar, si ya existe un libro con el mismo ISBN, o con el mismo título y algún autor en común, se pregunta si añadirlo de todos modos.

Casos a cubrir: ISBN-10/13, códigos inválidos, sin resultados, resultados incompletos, duplicados (mismo `isbn13` en la biblioteca del usuario), permiso de cámara denegado, fallos de red.

## 9. Sesiones, rachas, estimaciones y estadísticas

**Registro de sesión:** libro, fecha y duración, páginas inicial/final (si se conocen), páginas leídas, notas. [Confirmado, 2026-10-13] La **página inicial** solo se pide al registrar una lectura de otro día o al editar una sesión que la tiene, y entonces es obligatoria si hay página final (la página actual del libro ya no dice dónde se empezó entonces); para lo de hoy el campo no aparece y se parte de la página actual. Una lectura pasada nunca hace retroceder el libro.

**Rachas** [Confirmado, 2026-10-13]:

- **Día de lectura:** un día cuenta si tiene al menos **una sesión con más de 1 minuto o con más de 1 página** (basta una de las dos condiciones; «más de» es estricto: una sesión de exactamente 1 minuto y 1 página se guarda pero no cuenta para la racha). El criterio se evalúa **por sesión**, no sumando el día. Las constantes son `READING_DAY_MIN_MINUTES` y `READING_DAY_MIN_PAGES` en `utils/session.ts`. Una sesión válida de registrar sigue exigiendo minutos o páginas > 0 (reglas de Firestore).
- **Progreso:** registrar una sesión con página final actualiza la página actual del libro **en la misma operación atómica** (`createSession`). La página nunca retrocede (una sesión con fecha pasada no deshace un avance posterior); un libro pendiente, en pausa o abandonado pasa a «Leyendo» al leer, y al llegar a la última página (si se conoce el total) pasa a «Terminado».
- **Sincronización** [Confirmado, 2026-10-13]: `book.currentPage` es una copia desnormalizada que se mantiene coherente con las sesiones en **toda** operación, sin ajustes manuales. Crear, **editar** (`updateSession`) y **eliminar** (`deleteSession`) una sesión escriben la sesión y el libro en el mismo `writeBatch` (atómico) según `planBookAfterSessionChange`: si la sesión modificada fijaba la página del libro, el libro pasa a la página final más alta de sus demás sesiones (0 si no queda ninguna) y un libro terminado se reabre en «Leyendo»; una sesión que no fijaba el progreso solo lo mueve si lo supera. El ajuste manual de la página sigue existiendo solo para corregir (no deshace una corrección hacia atrás al borrar sesiones).
- **Fuente de datos única** [Confirmado, 2026-10-13]: `ReadingDataProvider` (`context/ReadingDataContext.tsx`, bajo `AuthProvider`) mantiene **una** suscripción a los libros y **una** a las sesiones, y calcula una sola vez los días y los días de lectura. `useBooks`, `useSessions`, `useBook` y `useReadingStats` leen de él; Inicio, Biblioteca, Calendario, detalle y registro de lecturas muestran siempre lo mismo y no parpadean al navegar.
- **Dónde se registra:** desde «Inicio» (acceso rápido), desde el detalle del libro, desde un día elegido en el Calendario (con esa fecha ya puesta) y con el cronómetro.
- **Sesiones en el detalle del libro** [Confirmado, 2026-10-13]: sección «Lecturas» (oculta si el libro no tiene sesiones) con el tiempo y las páginas totales, el número de sesiones y la lista de la más reciente a la más antigua (de 10 en 10), cada una con editar y eliminar. Deriva de la lista única de sesiones (`useBookSessions`); el orden de las sesiones es único para toda la app (`sortSessions`: fecha, luego registro, luego id).
- **Cronómetro** [Confirmado, 2026-10-13]: iniciar, pausar, reanudar, finalizar y descartar; uno solo a la vez. Mide con **marcas de tiempo** (`acumulado + ahora − inicio del tramo`), no con un contador: sigue contando con la app en segundo plano, y se guarda en el dispositivo (`AsyncStorage`, por usuario) para recuperarlo si la app se cierra. No se sincroniza entre dispositivos. «Finalizar» pausa y abre «Registrar lectura» con el libro, los minutos (redondeados, máx. 24 h) y el día de inicio puestos; al guardar se descarta el cronómetro. La sesión usa un **id propio** (`timer-<inicio>`): guardar dos veces la misma lectura no la duplica (las reglas rechazan el segundo `create`). Si se sale del formulario sin guardar, el cronómetro queda en pausa. Un cronómetro olvidado queda limitado a 24 h. En el formulario los minutos van **bloqueados** (campo deshabilitado): son los que midió el cronómetro y no se editan; solo se pueden añadir la página y las notas, y cambiar el día. Para otra duración hay que descartar el cronómetro y registrar la lectura a mano.
- **Meta diaria** [Confirmado, 2026-10-13]: la persona elige si se mide en **minutos** (1–1440) o en **páginas** (1–10000) y fija el valor; se guarda en `users/{uid}` como `dailyGoalMinutes` o `dailyGoalPages` (nunca los dos: cambiar de tipo escribe uno y borra el otro, y las metas anteriores, que solo tienen `dailyGoalMinutes`, siguen siendo de minutos sin migrar nada). Se fija, cambia o quita desde Inicio. El progreso de un día es lo leído ese día frente a la meta, medido en lo que pida su tipo: los minutos o las páginas de **todas** sus sesiones (manuales, del cronómetro y los avances de página; `utils/dailyGoal`). Inicio muestra el de hoy (barra, lo que falta o «Meta cumplida») y el Calendario, el de cualquier día elegido y una marca en los días cumplidos de la vista semanal. No se guarda historial de la meta: los días pasados se comparan con la meta actual (y con su tipo actual). El día es el `dateKey` (zona horaria del dispositivo); «hoy» es único para toda la app y se actualiza a medianoche. **Las reglas de Firestore deben estar desplegadas** (`npx firebase-tools deploy --only firestore`) para guardar una meta de páginas.
- **Actividad reciente** [Confirmado, 2026-10-13]: las últimas 5 sesiones, derivadas de la lista única (no hay otra fuente), con libro, día, duración y páginas; tocar una abre el libro. Sin sesiones muestra un estado vacío.
- **Registrar desde el Calendario** [Confirmado, 2026-10-13]: el detalle del día ofrece «Registrar lectura» con ese día ya puesto (`AddSession { day }`); un día pasado se guarda como sesión histórica (a las 12:00 locales) y un día futuro no se ofrece ni se acepta.
- Racha actual: días consecutivos hasta hoy; si hoy aún no hay sesión, se mantiene la del día anterior hasta que termine el día.
- Racha máxima: récord histórico.
- Se calculan sobre `dateKey` (zona horaria del usuario). Las sesiones son la fuente de verdad; cualquier contador guardado es solo caché recalculable.

**Estimación de tiempo restante:** `restante = (páginas totales − página actual) / velocidad`, donde la velocidad es páginas por minuto. Ejemplo: (300 − 120) / 1,5 = 120 minutos. Es una estimación. La velocidad personal basada en sesiones recientes es una mejora de 1.4; los libros sin páginas (audiolibros) necesitarán otro modelo [Pendiente].

**Estadísticas mensuales:** libros terminados, páginas, minutos, racha actual/máxima, progreso hacia el objetivo, géneros y autores más leídos. Siempre derivadas de datos reales. [Confirmado, 2026-10-13] **Implementado en la Fase 5** (`utils/statistics.ts`, pestaña Estadísticas): vista **Día** (tiempo, páginas, sesiones y cumplimiento de la meta de ese día) y vista **Mes** (tiempo, páginas, «días de lectura X de Y» sobre los días transcurridos, libros terminados en el mes, gráfico de lo leído cada día y días con la meta cumplida, y racha actual y récord). Todo se **deriva** de los resúmenes por día (`summarizeByDay`) y de los libros, sin contadores guardados, así que siempre coincide con Inicio, el Calendario y el detalle del libro y se recalcula al crear, editar o eliminar una sesión. El gráfico mide la unidad de la meta (minutos o páginas) o, sin meta, minutos; la meta solo se evalúa hasta hoy (un día futuro no cuenta como incumplido) y el cumplimiento es «días cumplidos / días transcurridos». Un libro cuenta como terminado en el mes de su `finishedAt` (zona horaria del dispositivo, igual que el `dateKey`) y solo si sigue en «Terminado». Géneros y autores más leídos, el resumen anual y el objetivo mensual en libros quedan [Pendiente] (el resumen anual existe en la vista Año del Calendario).

## 10. Logros y estantería

Etapas: (1) cuadrícula de portadas de libros terminados; (2) estantería visual con lomos sobre baldas (alturas, grosores y colores derivados de metadatos); (3) insignias y animaciones discretas.

**Definición de «terminado»** [Recomendado]: `status = finished` y, si `pageCount` existe, `currentPage = pageCount`; sin paginación, confirmación explícita del usuario.

Ejemplos de logros: primer libro, 7 días seguidos, 10 libros, primer libro de una saga, objetivo mensual cumplido. Los requisitos viven en código o configuración versionada.

## 11. Estructura de carpetas

Estructura (solo lo necesario para el MVP; el resto se añade al implementarlo):

```text
Lectoria/
├── CLAUDE.md
├── BookTracker_Plan_de_desarrollo.md
├── App.tsx, index.ts        Punto de entrada y providers
├── firebaseConfig.ts        Inicialización de Firebase (variables EXPO_PUBLIC_*)
├── firestore.rules, firestore.indexes.json, firebase.json
├── package.json, app.json, tsconfig.json, jest.rules.config.js
├── .env.example, .gitignore
├── assets/                  Imágenes, iconos, fuentes (iconos por defecto de Expo, a reemplazar)
├── docs/palette-original.txt
├── tests/rules/             Pruebas de reglas de Firestore (requieren el emulador)
└── src/
    ├── README.md            Responsabilidades de cada carpeta
    ├── components/          UI reutilizable
    ├── context/             Estado global (AuthContext)
    ├── navigation/          AppNavigator, AuthNavigator, TabNavigator
    ├── screens/
    │   ├── auth/            Login, Registro
    │   └── app/
    │       ├── home/  library/  reading/  calendar/  statistics/  profile/
    ├── services/            Firebase y catálogo (única capa que habla con Firestore)
    ├── hooks/               Acceso a datos desde las pantallas
    ├── types/               Modelos TypeScript y declaraciones de tipos
    ├── theme/               Tokens de color, tipografía, espaciado
    └── utils/               Funciones puras (fechas, ISBN, rachas, estadísticas) y sus pruebas (*.test.ts)
```

Las pruebas unitarias de `utils` se ubican junto al archivo que prueban (`*.test.ts`); las de reglas, en `tests/rules/`.

**Adaptación frente a la plantilla:** la plantilla define `screens/auth` y `screens/app` planos; con unas 16 pantallas previstas, `screens/app` se agrupa por dominio (`home`, `library`, `reading`, `calendar`, `statistics`, `profile`) sin crear niveles adicionales. Se añaden `services`, `hooks` y `types` (ya previstos en el plan original). `screens` orquestan, `components` pintan, `utils` calculan, `context` comparte estado, `services` accede a datos.

Convenciones [Recomendado]: código e identificadores en inglés; textos de interfaz y documentación en español; componentes y pantallas en `PascalCase.tsx`; hooks `useXxx.ts`; utils y services en `camelCase.ts`.

## 12. Plan de implementación

| Fase | Contenido | Versión |
|---|---|---|
| 1. Preparar — **cerrada** (2026-10-12, Android) | Fijar versiones (Expo, RN, React Navigation) leyendo su documentación; scaffold TypeScript; Firebase y `.env`; tema; `AuthContext`; navegación condicional; reglas iniciales con validación | 1.0 |
| 2. Biblioteca — **en curso**: modelo `UserBook`, validación del formulario y `booksService` (crear, escuchar, editar, cambiar estado, eliminar) `useBooks`, `BookCover`, `ReadingProgress` y `BookCard` y la pantalla de Biblioteca (cargando, error, vacío, lista y cuadrícula) hechos (2026-10-13; la parte visual aún sin ver en dispositivo). y el formulario «Añadir libro» (modo manual) hechos (2026-10-13; la parte visual aún sin ver en dispositivo). el detalle del libro (ver, editar, cambiar estado y eliminar) y `BookFilters` (búsqueda de texto y filtros por estado, género, autor y saga) hechos (2026-10-13). **Fase 2 cerrada (2026-10-13)** | `UserBook`; CRUD; `BookCard`, `BookCover`, `BookFilters`; búsqueda, filtros, estados de carga/error/vacío | 1.0 |
| 3. ISBN — **cerrada (2026-10-13)** | Servicio de catálogo (Open Library); formulario manual; escáner (`expo-camera`); duplicados y errores | 1.0 |
| 4. Sesiones — **cerrada (2026-10-13)**: modelo, validación, días de lectura, rachas y `sessionsService` (crear, editar y eliminar con actualización atómica del libro); fuente de datos única (`ReadingDataProvider`); formulario «Registrar lectura» (con página inicial en lecturas de otro día y al editar); pestaña Calendario (semana, mes y año; registrar desde un día); sesiones en el detalle del libro; cronómetro; meta diaria; actividad reciente en Inicio. Probada en Android por el usuario | Formulario de sesión; progreso; calendario y rachas | 1.0 |
| 5. Estadísticas — **cerrada (2026-10-13)**: pestaña Estadísticas con vistas **Día** y **Mes** (tiempo, páginas, sesiones, días de lectura, libros terminados, gráfico diario, cumplimiento de la meta y racha), derivada de las mismas sesiones y libros que el resto de la app, y pruebas de fechas y casos límite (zonas horarias, cambio de día, mes y año, bisiestos, fechas pasadas y futuras, días sin actividad, metas cumplidas, sesiones creadas, editadas y eliminadas). | Resúmenes diarios/mensuales; objetivos; pruebas de fechas y casos límite | 1.0 |
| 6. Experiencia lectora | Deseos/compras, notas y reseñas (1.1); autores, sagas, colecciones (1.2); ruleta y logros (1.3) | 1.1–1.3 |
| 7. Pulir | Estantería realista y recordatorios (1.3–1.4); pruebas de reglas; accesibilidad, rendimiento; capturas y documentación | 1.4–1.5 |

Orden de la Fase 1 (plantilla): theme → AuthContext → AppNavigator → Login/Registro → primera pantalla con datos de Firestore. En Lectoria, la primera escritura en Firestore es el perfil `users/{uid}` (`ensureUserProfile`), creado tras el primer inicio de sesión; la primera pantalla con datos reales de Firestore llega en la Fase 2 (biblioteca).

**Pasos manuales para completar la Fase 1** (requieren tu cuenta de Firebase):

1. Crear el proyecto en la consola de Firebase, registrar una app web y activar Authentication (correo/contraseña) y Firestore.
2. Copiar `.env.example` a `.env` y completar los valores.
3. Desplegar las reglas: `firebase deploy --only firestore --project lectoria-1208a` (necesita `firebase login`). **Hecho el 2026-10-12**: base de datos `(default)` creada en `us-east1` (Firestore estándar, modo nativo) y reglas e índices desplegados. La región no se puede cambiar.
4. Ejecutar `npx expo start`, registrar una cuenta y comprobar: sesión persistente al reabrir, cierre de sesión y creación de `users/{uid}`.

**Pasos manuales para el acceso con Google.** Android: completado y probado (2026-10-12). iOS: pendiente (requiere cuenta de Apple Developer y `GoogleService-Info.plist`). Pasos de referencia:

1. En Firebase, registrar una app **Android** (paquete `com.lectoria.app`) y una app **iOS** (bundle ID `com.lectoria.app`). Descargar `google-services.json` y `GoogleService-Info.plist` y guardarlos en la raíz del proyecto.
2. Copiar el *ID de cliente web* (Authentication > Método de acceso > Google > Configuración del SDK web) a `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en `.env`.
3. `npx eas-cli login` y `npx eas-cli init` (enlaza el proyecto con tu cuenta de Expo).
4. `npx eas-cli build --profile development --platform android`. Cuando termine, obtener la huella SHA-1 con `npx eas-cli credentials`, añadirla a la app Android en Firebase y volver a descargar `google-services.json`; si cambia, repetir el build.
5. iOS: requiere cuenta de Apple Developer (de pago) y registrar el dispositivo; sin ella, solo se puede probar Android.
6. Instalar el build en el teléfono y ejecutar `npx expo start` (usa la app de desarrollo en lugar de Expo Go).

**Vinculación de métodos de acceso** (implementada el 2026-10-12): en Mi espacio → «Métodos de acceso» se puede vincular Google a una cuenta de correo y añadir una contraseña a una cuenta de Google (`linkWithCredential`). Es explícita: no se depende de la fusión automática de Firebase cuando el mismo correo llega por dos métodos, cuyo comportamiento (cuenta de correo sin verificar frente a Google) no está verificado [Pendiente: probarlo]. Si el correo ya existe con otro método, los mensajes de error indican cómo vincularlos.

## 13. Estrategia de pruebas y criterios de aceptación

**Comandos** [Confirmado, ejecutados en la Fase 1]: `npm run typecheck`, `npm test` (unitarias), `npm run test:rules` (reglas; levanta el emulador de Firestore y necesita Java). Ver `CLAUDE.md`.

**Pruebas** [Recomendado]: pruebas unitarias de `utils` (ISBN, rachas, estadísticas, estimaciones, fechas con cambios de zona horaria y de mes); pruebas de reglas de Firestore con el emulador (acceso cruzado entre usuarios, campos inválidos); verificación manual de flujos y estados de error en dispositivo.

**Criterios de aceptación del MVP**

- [x] Crear cuenta e iniciar sesión; la sesión persiste al reabrir la app.
- [x] Añadir un libro manualmente y por ISBN cuando haya información disponible.
- [x] Buscar, filtrar, editar y eliminar libros.
- [x] Registrar sesiones y consultar el progreso.
- [x] Ver los días de lectura en el calendario.
- [x] Rachas y estadísticas mensuales correctas (cada sesión contada una vez).
- [x] Datos aislados entre usuarios (verificado con el emulador).
- [ ] Datos recuperados tras cerrar y reabrir la app. *(sin verificar de forma específica en dispositivo)*
- [ ] Errores de red, cargas y estados vacíos gestionados. *(implementado en todas las pantallas; el comportamiento sin conexión no se ha probado en dispositivo)*
- [x] Pruebas básicas de cálculos y de seguridad ejecutadas.

**Cierre de la 1.0** [Confirmado, 2026-10-13]: la versión 1.0 se declara cerrada con las Fases 1 a 5 hechas y probadas en Android. Quedan fuera, y pasan a la 1.1 o a la fase de pulido: el **objetivo mensual en libros**, la verificación específica sin conexión y de «recuperar datos al reabrir», iOS (requiere cuenta de Apple Developer), el tema oscuro, el borrado completo de la cuenta y la publicación en tiendas (build de producción, capturas y ficha).

## 14. Riesgos, supuestos y decisiones pendientes

**Riesgos**

- Cambios entre versiones de Expo/React Navigation → fijar versión y leer su documentación antes de codificar.
- Calidad y cobertura del proveedor bibliográfico → entrada manual como respaldo; capa `bookCatalogService`.
- Costes de lectura de Firestore por estadísticas calculadas en cliente → paginar y evaluar resúmenes cuando haya volumen.
- Zonas horarias y rachas → `dateKey` y pruebas dedicadas.
- Borrado de datos de cuenta incompleto → ver sección 7.

**Supuestos:** un solo idioma de interfaz (español) en 1.0; uso principalmente con conexión.

**Pendientes**

1. ~~Versión exacta de Expo/SDK~~ — resuelto: SDK 57 (sección 2).
2. ~~Proveedor bibliográfico~~ — resuelto: Open Library (sección 8).
3. ~~Tema oscuro~~ — resuelto (2026-10-14): implementado siguiendo al sistema; faltan el conmutador interno y el cambio en vivo.
4. Comportamiento sin conexión: la sesión se persiste con AsyncStorage (`getReactNativePersistence`, implementado en la Fase 1 pero **aún no probado en un dispositivo**). La caché sin conexión de Firestore en React Native sigue **por verificar**; 1.0 solo exige recuperar datos al reabrir con conexión.
5. Objetivos anuales y unidades para el objetivo mensual. (El objetivo diario en páginas ya está resuelto, 2026-10-13.)
6. Entidades propias de autores y sagas (1.2); caché compartida de catálogo.
7. Modelo para audiolibros.
8. Cómo borrar la cuenta completa (cliente vs. backend) y requisitos de las tiendas. **Decisión (2026-10-13): se deja sin resolver por ahora.** Al borrar un usuario desde la consola de Authentication, su `users/{uid}` y subcolecciones quedan huérfanos en Firestore: limpiarlos automáticamente exige una función de servidor (plan Blaze, de pago por uso) y el proyecto está en el plan gratuito. Se descartaron la función con Blaze y la alternativa sin costo (botón «Eliminar cuenta» + script de limpieza manual). Hasta publicar en tiendas, los huérfanos se borran a mano desde la consola de Firestore; antes de publicar hay que reabrir este punto, porque las tiendas suelen exigir poder eliminar la cuenta desde la app.
9. Internacionalización.
10. Renombrar este archivo a un nombre con «Lectoria».

## 15. Registro de diagnóstico (revisión del plan original)

**Críticos (corregidos)**

| Problema | Resolución |
|---|---|
| `catalogBooks` compartido requería un backend de escritura, incompatible con «sin servidor propio» y con las reglas `write: false` | Aplazado; metadatos en el libro personal (sección 6) |
| Logros «validados por backend» sin backend definido | Logros derivados en cliente; biblioteca privada, sin riesgo de trampa relevante |
| Reglas con comodín `/{subcollection}/{documentId}` que permitían escribir cualquier cosa en el espacio del usuario, contradiciendo la propia advertencia del plan | Subcolecciones enumeradas; validación de campos como requisito de Fase 1 |
| Progreso con dos fuentes (`currentPage` y sesiones) sin regla de reconciliación | Regla explícita de fuente de verdad (sección 6) |

**Importantes (corregidos)**

| Problema | Resolución |
|---|---|
| Nombre «BookTracker» frente al producto Lectoria | Renombrado en el contenido |
| Filtros por género y saga sin campos en `UserBook` | Añadidos `genres`, `seriesName`, `seriesOrder` |
| Rachas por zona horaria sin dato que lo soporte | `dateKey` en sesiones y zona en el perfil |
| Lista de deseos, compras y `want_to_read`/`isPurchased` solapados | `acquisition` y eliminación de colecciones duplicadas |
| `collections` con tipos `genre/author/series` duplicando entidades | Colecciones solo `custom`; autores y sagas derivados |
| Navegación por pestañas sin `bottom-tabs` en la plantilla | Añadido y justificado |
| Posible choque Expo Router vs. React Navigation en el scaffold | Documentado |
| Sin estrategia de pruebas, escala de `rating` ni objetivo mensual definido | Añadidos |
| Eliminación de cuenta/subcolecciones no contemplada | Sección 7 |
| Mapa de fases (1–7) sin relación con versiones (1.0–1.5) | Tabla de fases con versión |
| Referencia a `AGENTS.md` de otro proyecto | Sustituida por regla de fijar versión |

**Menores (corregidos)**

Tablas Markdown con línea en blanco que impedía su renderizado; fórmulas LaTeX sustituidas por texto plano; estructura de carpetas reducida a lo necesario para el MVP.

**Conservado del plan original:** visión y dos áreas, MVP y versiones, cinco pestañas, separación libro/registro personal, escaneo ISBN con respaldo manual, reglas de sesiones y rachas, estantería en tres etapas, criterios de aceptación y recomendación de priorizar datos sobre estética.
