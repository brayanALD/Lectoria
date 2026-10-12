# Lectoria — Plan de desarrollo de la aplicación móvil

> Estado: **planificación**. Todavía no existe proyecto ejecutable (sin `package.json`, sin dependencias instaladas).
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
| Backend | Firebase Auth (email/contraseña) + Firestore | [Confirmado] |
| Estado global | Context API (`AuthContext`) | [Confirmado] |
| Almacenamiento local | AsyncStorage (sesión y preferencias) | [Confirmado] |
| Fechas | dayjs | [Confirmado] |
| Iconos | `@expo/vector-icons` | [Confirmado] |
| Layout seguro | `react-native-safe-area-context` | [Confirmado] |
| Cámara / ISBN | `expo-camera` (verificar compatibilidad con la versión de Expo elegida) | [Recomendado] |
| Notificaciones locales | `expo-notifications` (versión 1.4; verificar limitaciones) | [Recomendado] |
| Proveedor bibliográfico | Open Library o Google Books, detrás de `bookCatalogService` | [Pendiente] |
| Pruebas | Jest (vía `jest-expo`) para `utils`; emulador de Firestore para reglas | [Recomendado] |
| Versión exacta de Expo / SDK | Se fija al crear el proyecto, leyendo la documentación de esa versión (docs.expo.dev) | [Pendiente] |

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
| 4. Estadísticas básicas | Libros terminados, páginas, minutos y objetivo mensual |
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

Paleta oficial (archivo original: `C:\Users\ASUS\Desktop\Code\ColorPalette\palette (2).txt`, copiado a `docs/palette-original.txt`). **No se modifican estos valores.**

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
| `border` | Evergreen al 12 % de opacidad | Bordes y divisores |
| `pressed` | `primary` al 85 % de opacidad | Estado presionado |
| `disabled` | `textPrimary` al 38 % de opacidad | Elementos deshabilitados |
| `success` | Hunter Green | Confirmaciones, objetivo cumplido |
| `warning` | Soft Fawn | Avisos |
| `error` | **#B3261E** (complementario) | Errores y acciones destructivas |

**Tema oscuro** [Pendiente: decidir si entra en 1.0]: `background` = Evergreen, `textPrimary` = Porcelain, `accent` = Soft Fawn, `primary` sería un tono más claro que Hunter Green (no definido en la paleta; Hunter Green sobre Evergreen tiene contraste 1,92:1 y no sirve como texto/botón). `error` oscuro propuesto: `#F0A19B`.

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
users/{uid}                      Perfil, preferencias, objetivos (diario/mensual), zona horaria
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

- **Fuente de verdad del progreso:** las estadísticas (páginas, minutos, rachas) se calculan **solo desde las sesiones**. `currentPage` es un valor almacenado que se actualiza a `endPage` en la misma operación en lote (`writeBatch`) que crea la sesión, y puede ajustarse manualmente. Editar o borrar una sesión no retrocede `currentPage` automáticamente.
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
- **Objetivos**: dentro de `users/{uid}`. Mínimo: objetivo mensual en **número de libros** y objetivo diario en minutos. Otras unidades (páginas) [Pendiente].
- **Resúmenes `statsMonthly`**: no en 1.0; se calculan en el cliente desde las sesiones. Se evaluará una caché cuando el volumen lo justifique.
- **Logros**: se derivan de los datos del usuario y se calculan en el cliente. Como la biblioteca es privada, no hay motivo para validarlos en un backend; se descarta la colección `achievements` como fuente de verdad (puede guardarse solo la fecha de desbloqueo).

## 7. Seguridad y privacidad

Las reglas de Firestore deben impedir que un usuario lea o modifique datos de otro; ocultar pantallas no es suficiente.

Reglas iniciales (base de partida; **no probadas**, deben validarse con el emulador). Se enumeran las subcolecciones en lugar de un comodín, para que cada nueva colección se añada de forma consciente:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedInAs(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read, write: if signedInAs(uid);

      match /books/{bookId}       { allow read, write: if signedInAs(uid); }
      match /sessions/{sessionId} { allow read, write: if signedInAs(uid); }
      // collections y reminders se añaden al implementar esas versiones
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Requisitos antes de usar con usuarios reales** (parte de la Fase 1 y la Fase 7):

1. Validar campos permitidos, tipos y límites (páginas ≥ 0, `rating` 1–5, duraciones y fechas razonables, longitud de textos).
2. Proteger campos de perfil que no deban cambiarse libremente.
3. Nunca dejar Firestore en modo de prueba abierto (plantilla).
4. Probar las reglas con el emulador de Firestore.
5. Claves de Firebase en variables `EXPO_PUBLIC_*` dentro de `.env` fuera de git; las claves de Firebase para cliente no son secretos por sí mismas, pero la seguridad real depende de las reglas. No incluir claves privadas ni cuentas de servicio en el repositorio.

**Privacidad** [Recomendado]: reseñas y notas privadas por defecto; exportación de datos (1.5); **eliminación de cuenta**: Firestore no borra subcolecciones al eliminar el documento padre, por lo que el borrado completo requiere eliminar `books` y `sessions` desde la app (o una función en backend) además de `deleteUser`. Las tiendas de aplicaciones suelen exigir poder eliminar la cuenta desde la app [Pendiente: verificar requisitos vigentes antes de publicar].

## 8. Alta de libros: ISBN y entrada manual

**Método A — escaneo:** abrir cámara → detectar EAN-13 → validar ISBN-13 (aceptar y normalizar ISBN-10) → consultar proveedor → mostrar metadatos → confirmar/corregir → guardar.

**Método B — manual:** título, autor, páginas, género, etc. Es el respaldo obligatorio si no hay resultado o código legible.

Arquitectura:

- `expo-camera` para lectura (verificar compatibilidad con la versión elegida).
- `src/services/bookCatalogService.ts`: interfaz común «buscar por ISBN»; el escáner no conoce al proveedor.
- Proveedor [Pendiente]: Open Library no requiere clave; Google Books puede requerir clave (cuya exposición en cliente debe evaluarse).

Casos a cubrir: ISBN-10/13, códigos inválidos, sin resultados, resultados incompletos, duplicados (mismo `isbn13` en la biblioteca del usuario), permiso de cámara denegado, fallos de red.

## 9. Sesiones, rachas, estimaciones y estadísticas

**Registro de sesión:** libro, fecha y duración, páginas inicial/final (si se conocen), páginas leídas, notas.

**Rachas** [Recomendado]:

- Un día cuenta si tiene al menos una sesión válida (`pagesRead > 0` o `durationMinutes > 0`).
- Racha actual: días consecutivos hasta hoy; si hoy aún no hay sesión, se mantiene la del día anterior hasta que termine el día.
- Racha máxima: récord histórico.
- Se calculan sobre `dateKey` (zona horaria del usuario). Las sesiones son la fuente de verdad; cualquier contador guardado es solo caché recalculable.

**Estimación de tiempo restante:** `restante = (páginas totales − página actual) / velocidad`, donde la velocidad es páginas por minuto. Ejemplo: (300 − 120) / 1,5 = 120 minutos. Es una estimación. La velocidad personal basada en sesiones recientes es una mejora de 1.4; los libros sin páginas (audiolibros) necesitarán otro modelo [Pendiente].

**Estadísticas mensuales:** libros terminados, páginas, minutos, racha actual/máxima, progreso hacia el objetivo, géneros y autores más leídos. Siempre derivadas de datos reales.

## 10. Logros y estantería

Etapas: (1) cuadrícula de portadas de libros terminados; (2) estantería visual con lomos sobre baldas (alturas, grosores y colores derivados de metadatos); (3) insignias y animaciones discretas.

**Definición de «terminado»** [Recomendado]: `status = finished` y, si `pageCount` existe, `currentPage = pageCount`; sin paginación, confirmación explícita del usuario.

Ejemplos de logros: primer libro, 7 días seguidos, 10 libros, primer libro de una saga, objetivo mensual cumplido. Los requisitos viven en código o configuración versionada.

## 11. Estructura de carpetas

Estructura inicial creada (solo lo necesario para el MVP; el resto se añade al implementarlo):

```text
Lectoria/
├── CLAUDE.md
├── BookTracker_Plan_de_desarrollo.md
├── .env.example
├── .gitignore
├── assets/                  Imágenes, iconos, fuentes
├── docs/palette-original.txt
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
    ├── types/               Modelos TypeScript
    ├── theme/               Tokens de color, tipografía, espaciado
    └── utils/               Funciones puras (fechas, ISBN, rachas, estadísticas)
```

Archivos que se crearán al hacer el scaffold (Fase 1), en la raíz: `App.tsx`, `firebaseConfig.ts`, `firestore.rules`, `firestore.indexes.json`, `package.json`, `app.json`.

**Adaptación frente a la plantilla:** la plantilla define `screens/auth` y `screens/app` planos; con unas 16 pantallas previstas, `screens/app` se agrupa por dominio (`home`, `library`, `reading`, `calendar`, `statistics`, `profile`) sin crear niveles adicionales. Se añaden `services`, `hooks` y `types` (ya previstos en el plan original). `screens` orquestan, `components` pintan, `utils` calculan, `context` comparte estado, `services` accede a datos.

Convenciones [Recomendado]: código e identificadores en inglés; textos de interfaz y documentación en español; componentes y pantallas en `PascalCase.tsx`; hooks `useXxx.ts`; utils y services en `camelCase.ts`.

## 12. Plan de implementación

| Fase | Contenido | Versión |
|---|---|---|
| 1. Preparar | Fijar versiones (Expo, RN, React Navigation) leyendo su documentación; scaffold TypeScript; Firebase y `.env`; tema; `AuthContext`; navegación condicional; reglas iniciales con validación | 1.0 |
| 2. Biblioteca | `UserBook`; CRUD; `BookCard`, `BookCover`, `BookFilters`; búsqueda, filtros, estados de carga/error/vacío | 1.0 |
| 3. ISBN | Servicio de catálogo; formulario manual; escáner; duplicados y errores | 1.0 |
| 4. Sesiones | Formulario de sesión; progreso; calendario y rachas | 1.0 |
| 5. Estadísticas | Resúmenes diarios/mensuales; objetivos; pruebas de fechas y casos límite | 1.0 |
| 6. Experiencia lectora | Deseos/compras, notas y reseñas (1.1); autores, sagas, colecciones (1.2); ruleta y logros (1.3) | 1.1–1.3 |
| 7. Pulir | Estantería realista y recordatorios (1.3–1.4); pruebas de reglas; accesibilidad, rendimiento; capturas y documentación | 1.4–1.5 |

Orden de la Fase 1 (plantilla): theme → AuthContext → AppNavigator → Login/Registro → primera pantalla con datos de Firestore.

## 13. Estrategia de pruebas y criterios de aceptación

**Pruebas** [Recomendado]: pruebas unitarias de `utils` (ISBN, rachas, estadísticas, estimaciones, fechas con cambios de zona horaria y de mes); pruebas de reglas de Firestore con el emulador (acceso cruzado entre usuarios, campos inválidos); verificación manual de flujos y estados de error en dispositivo.

**Criterios de aceptación del MVP**

- [ ] Crear cuenta e iniciar sesión; la sesión persiste al reabrir la app.
- [ ] Añadir un libro manualmente y por ISBN cuando haya información disponible.
- [ ] Buscar, filtrar, editar y eliminar libros.
- [ ] Registrar sesiones y consultar el progreso.
- [ ] Ver los días de lectura en el calendario.
- [ ] Rachas y estadísticas mensuales correctas (cada sesión contada una vez).
- [ ] Datos aislados entre usuarios (verificado con el emulador).
- [ ] Datos recuperados tras cerrar y reabrir la app.
- [ ] Errores de red, cargas y estados vacíos gestionados.
- [ ] Pruebas básicas de cálculos y de seguridad ejecutadas.

## 14. Riesgos, supuestos y decisiones pendientes

**Riesgos**

- Cambios entre versiones de Expo/React Navigation → fijar versión y leer su documentación antes de codificar.
- Calidad y cobertura del proveedor bibliográfico → entrada manual como respaldo; capa `bookCatalogService`.
- Costes de lectura de Firestore por estadísticas calculadas en cliente → paginar y evaluar resúmenes cuando haya volumen.
- Zonas horarias y rachas → `dateKey` y pruebas dedicadas.
- Borrado de datos de cuenta incompleto → ver sección 7.

**Supuestos:** un solo idioma de interfaz (español) en 1.0; uso principalmente con conexión.

**Pendientes**

1. Versión exacta de Expo/SDK y librerías asociadas.
2. Proveedor bibliográfico (Open Library vs. Google Books) y manejo de su clave.
3. Tema oscuro: ¿en 1.0 o después? (y su `primary`).
4. Comportamiento sin conexión: persistencia de sesión con AsyncStorage y caché de Firestore en React Native **por verificar** en la documentación de la versión elegida; 1.0 solo exige recuperar datos al reabrir con conexión.
5. Unidades adicionales de objetivos (páginas) y objetivos anuales.
6. Entidades propias de autores y sagas (1.2); caché compartida de catálogo.
7. Modelo para audiolibros.
8. Cómo borrar la cuenta completa (cliente vs. backend) y requisitos de las tiendas.
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
