# Lectoria — Guía de rediseño visual para Claude Design

> **Para quién es este documento:** Claude Design, que va a modernizar la interfaz de Lectoria.
> **Qué contiene:** el estado **real** del frontend (verificado en el código el 2026-10-14, versión 1.0), las reglas que no se pueden romper, el sistema visual actual, el inventario de pantallas y componentes, lo implementado y lo planificado, y directrices concretas de rediseño.
> **Regla de lectura:** donde esta guía dice «existe», está en el código; donde dice «planificado» o «pendiente», **no existe todavía** y no debe darse por hecho en el diseño.

---

## 0. Encargo y alcance

**Objetivo:** modernizar la interfaz **sin perder** su minimalismo, su identidad (paleta, logo, tono) ni su funcionalidad.

**Sí puedes cambiar:** la apariencia (superficies, formas, jerarquía tipográfica, iconografía, composición de pantallas, microinteracciones) y, para ello, los *valores* de `src/theme/`.

**No puedes cambiar (sin consultar):**

- La lógica de negocio, los servicios, los hooks, los modelos de datos y las reglas de Firestore.
- La arquitectura (React Navigation, Context API, fuente de datos única) y los nombres de rutas.
- La paleta oficial (cinco colores, ver §3.1) y el logo.
- Las funcionalidades ni la navegación existentes: lo que hoy se puede hacer en N toques debe seguir pudiéndose.
- Añadir dependencias (incluidas fuentes y librerías de animación o de gráficos): hay que **proponerlo y esperar respuesta**.

**Qué es la app:** **React Native + Expo SDK 57 + TypeScript** (no es web: no hay CSS, solo `StyleSheet`). Todo el texto de interfaz está en **español** (tuteo, frases cortas). Los identificadores de código, en inglés.

**Cómo entregar** (ver §12): cambios en `src/theme/*` y en componentes/pantallas existentes, no una reescritura; y la lista de qué cambió y por qué.

---

## 1. El producto en una página

**Lectoria** es un *Book Tracker* para móvil: biblioteca personal, registro de lecturas, calendario, rachas y estadísticas. Cada usuario tiene su biblioteca privada. El nombre une *lectura* y *trayectoria*; el logo es un libro abierto con un camino dorado, un marcador y una estrella.

**Prioridad de producto:** registrar una lectura en muy pocos toques desde Inicio. El resto de la interfaz está al servicio de **mantener el hábito** (racha, meta diaria) y **ver la evolución** (calendario, estadísticas).

**Tono visual actual:** sobrio, claro, verde bosque sobre blanco verdoso, con dorado como detalle. Casi sin texto de ayuda. Sin sombras. Solo tema claro.

---

## 2. Reglas innegociables (y cómo se verifican)

Estas reglas son del proyecto (`CLAUDE.md`). Varias están **vigiladas por pruebas automáticas**: si un rediseño las rompe, `npm test` falla.

### 2.1 Design tokens estrictos — *prueba: `src/theme/designTokens.test.ts`*

Los valores de diseño se escriben **solo** en `src/theme/` (`colors.ts`, `spacing.ts`, `typography.ts`) y el resto del código los usa **por nombre**:

| Qué | Token | Prohibido fuera de `src/theme/` |
|---|---|---|
| Color | `colors.*` | hex (`#fff`), `rgb()/rgba()/hsl()`, colores con nombre (`'white'`, `'red'`…) en `color`/`backgroundColor`… |
| Texto | `fontSize.*`, `fontWeight.*`, `maxFontScale` | `fontSize: 14` |
| Opacidad | `opacity.*` | `opacity: 0.5` |
| Iconos | `iconSize.*` | `size={24}` |
| Espaciado y radios | `spacing.*`, `radius.*` | (no se vigila por prueba, pero es regla: sin números sueltos de diseño) |
| Zona táctil | `minTouchSize` | alturas de control menores a 48 |

- Se permite **operar con tokens** (p. ej. `fontSize.xl * 2`, `minTouchSize / 2`) y definir constantes locales de **geometría** de un componente (p. ej. alto de una barra), documentadas.
- Si hace falta un valor nuevo: **añadirlo como token con nombre semántico** y, si es un color, **derivado de la paleta** (ver 2.2).
- `'transparent'` se usa tal cual.

### 2.2 Paleta cerrada — *prueba: `src/theme/colors.test.ts`*

- Solo existen los cinco colores oficiales (§3.1) más un color de error (`#B3261E`). La prueba **falla si aparece cualquier otro hex** en `colors.ts`.
- Los matices nuevos (transparencias, mezclas) deben **derivarse de la paleta**, como ya hacen `border`, `overlay` y `pressed` con `withAlpha(...)`.
- **Soft Fawn (dorado) no se usa como texto ni como icono informativo sobre Porcelain** (contraste 2,08:1). Sí como fondo de insignias y círculos con texto/icono Evergreen encima.

### 2.3 Contrastes y accesibilidad — *prueba: `colors.test.ts`*

- Texto normal ≥ **4,5:1**; bordes de controles y gráficos ≥ **3:1**. Ya verificado para los pares actuales (§3.1).
- Si se cambia un color de `colors.ts`, hay que mantener esos pares o actualizar la prueba justificándolo.

### 2.4 Otras reglas de proyecto

1. **Skeletons de carga** con la forma del contenido final (`Skeleton`, `SkeletonPulse` y los `*Skeleton` de `components/`). **Nunca** pantalla en blanco ni spinner a pantalla completa; el spinner solo vive dentro de un botón que ejecuta una acción. **Las medidas del skeleton deben coincidir con las del componente real** (si cambias el alto de una card, cambia también su skeleton).
2. **Ley de Hick:** una acción principal por pantalla. Sin títulos, subtítulos ni párrafos de ayuda que repitan lo que ya se ve; los ejemplos van como `placeholder`. Si una sección no tiene opciones, **se oculta** (no se explica que está vacía). No añadir controles «por si acaso».
3. **Estados explícitos** en toda lista o pantalla de datos: **cargando, vacío y error**. Un estado vacío lleva icono + título (+ acción); la descripción solo en mensajes de error.
4. **Componentes:** antes de crear uno, buscar uno existente en `src/components/`. Un componente nuevo en `components/` solo si se usa en más de una pantalla; si no, junto a su pantalla.
5. **Formularios:** `TextField`; campos encadenados con `ref` + `returnKeyType="next"` + `submitBehavior="submit"` + `onSubmitEditing`; el último `done` y envía; con `KeyboardAvoidingView behavior="padding"` y `ScrollView`.
6. **Áreas seguras** (`react-native-safe-area-context`) respetadas.
7. **Iconos nativos de la app** (`icon.png`, `android-icon-*`, `splash-icon.png`, configuración de `expo-splash-screen`) **requieren un build nuevo de EAS** para verse; no los toques salvo petición expresa. `assets/logo.png` (dentro de la app) sí se actualiza al recargar.
8. **El logo está sobre transparencia y solo se ve bien sobre fondos claros** (sobre Evergreen/Hunter Green pierde la forma). Un fondo oscuro exigiría una variante del logo.

---

## 3. Sistema visual actual

### 3.1 Paleta y tokens de color (`src/theme/colors.ts`)

| Nombre | Hex | Rol |
|---|---|---|
| **Evergreen** | `#14281D` | Texto principal; superficie oscura; base de `border`/`overlay` |
| **Hunter Green** | `#355834` | `primary`: acción principal, pestaña activa, progreso, enlaces, `success` |
| **Olive Bark** | `#6E633D` | `textSecondary` y `outline` (borde de controles) |
| **Soft Fawn** | `#C2A878` | `accent` (insignias, círculos de icono, detalles), `warning` |
| **Porcelain** | `#F1F5F2` | `background`, `surface`, `onPrimary` |
| Error (añadido) | `#B3261E` | `error` (errores y acciones destructivas) |

Tokens semánticos que **existen hoy** (los únicos que debes usar o ampliar):

| Token | Valor | Uso |
|---|---|---|
| `background` | Porcelain | Fondo de pantallas |
| `surface` | Porcelain | Campos y hojas (igual al fondo: los campos se definen por su borde `outline`) |
| `surfaceTint` | Hunter Green al 7 % | **Superficie tonal** de cards y bloques decorativos (sin borde). Añadida en el rediseño del 2026-10-14 |
| `accentSoft` | Soft Fawn al 32 % | Fondo suave de círculos de icono (p. ej. `EmptyState`). Añadida el 2026-10-14 |
| `textPrimary` | Evergreen | Títulos y texto principal |
| `textSecondary` | Olive Bark | Metadatos, apoyo |
| `primary` / `onPrimary` | Hunter Green / Porcelain | Acción principal y su texto |
| `accent` / `onAccent` | Soft Fawn / Evergreen | Insignias, círculos de icono |
| `border` | Evergreen al 12 % | Divisores y bordes **decorativos** (bajo contraste a propósito) |
| `outline` | Olive Bark | Borde de **controles** (≥ 3:1) |
| `overlay` | Evergreen al 50 % | Fondo tras hojas modales |
| `pressed` | Hunter Green al 85 % | Estado presionado del botón primario |
| `success` | Hunter Green | Meta cumplida, confirmaciones |
| `warning` | Soft Fawn | (definido; uso mínimo) |
| `error` | `#B3261E` | Errores y acciones destructivas |

Contrastes verificados (WCAG): Evergreen/Porcelain 14,13:1 · Hunter Green/Porcelain 7,35:1 · Olive Bark/Porcelain 5,43:1 · Evergreen/Soft Fawn 6,78:1 · Error/Porcelain 5,94:1 · **Soft Fawn/Porcelain 2,08:1 (no usar para texto/iconos)** · Hunter Green/Evergreen 1,92:1 (no combinar).

**Tema oscuro (2026-10-14):** **existe, sigue al sistema hasta que la persona elige y se cambia en vivo desde Configuración (§18).** `colors.ts` define `lightColors` y `darkColors`, ambos derivados de la misma paleta: fondo Evergreen, texto Porcelain, texto secundario Soft Fawn (6,78:1), `primary` = Hunter Green aclarado hacia Porcelain (Hunter Green puro sobre Evergreen solo da 1,92:1), error `#F0A19B`. El tema activo lo da `ThemeProvider` (`useTheme()`; los estilos se crean con `makeStyles`), de modo que cambia con la app abierta. `userInterfaceStyle: "automatic"` exige un build nuevo de EAS. La marca clara es fija en ambos temas (`brandSurface`, `onBrandSurface`, `brandOutline`): el logo va sobre una losa clara, y la pantalla de arranque y el botón de Google conservan su fondo claro. Los contrastes de los dos temas los verifica `colors.test.ts`.

### 3.2 Tipografía (`src/theme/typography.ts`)

- **Familia (2026-10-14):** **Figtree** (sans, interfaz) y **Literata** (serif pensada para lectura, títulos y cifras protagonistas: racha, reloj, cifras de estadísticas, encabezados de sección y de navegación, títulos de libro). Vienen de `@expo-google-fonts/*`, importando cada peso por separado (`src/theme/fonts.ts`; solo 5 archivos, ≈640 KB) y se cargan en `App.tsx` con `useFonts`. Tokens: `fontFamily.regular | semibold | bold | display | displayBold`.
- **Tamaños:** `xs` 12 · `sm` 13 · `md` 16 · `lg` 20 · `xl` 28.
- **Pesos:** se expresan **solo con la familia** (`fontFamily.*`): `fontWeight` está **prohibido** porque en Android no elige el archivo de una familia personalizada, y todo estilo que fije `fontSize` debe fijar también `fontFamily` (lo vigila `designTokens.test.ts`). Si las fuentes no cargan, la app sigue con la del sistema.
- **Escalas locales ya en uso:** la cifra de la racha (`fontSize.xl × 2` = 56) y el reloj del cronómetro (`fontSize.xl × 2`, cifras tabulares `tabular-nums`).
- **Escalado del sistema:** el texto escala con la preferencia del usuario; `maxFontScale = 1.4` se aplica con `maxFontSizeMultiplier` **solo** a etiquetas de tamaño fijo (chips, días del calendario). **Sin alturas fijas en contenedores de texto.**
- No hay `lineHeight` ni `letterSpacing` definidos (valores por defecto del sistema).

### 3.3 Espaciado, formas y tamaños (`src/theme/spacing.ts`)

| Token | Valores |
|---|---|
| `spacing` | `xs` 4 · `sm` 8 · `md` 16 · `lg` 24 · `xl` 32 |
| `radius` | `sm` 8 (portadas) · `md` 12 (campos) · `lg` 18 (cards, bloques, botones) · `pill` 999 (chips, etiquetas, círculos, barras). Las hojas inferiores usan `md × 2` = 24 arriba |
| `minTouchSize` | 48 |
| `iconSize` | `sm` 20 · `md` 24 · `lg` 28 · `xl` 56 |
| `opacity` | `pressed` 0,85 · `disabled` 0,5 · `skeleton` 0,5 |

Patrón de maquetación dominante: pantallas con `padding: spacing.lg` (24), `gap` entre secciones de `spacing.lg`/`spacing.xl`, y gaps internos de `spacing.xs`–`spacing.md`.

### 3.4 Superficies, bordes y profundidad

- **Sombras (2026-10-14):** tokens `elevation.low` (cards pulsables: `BookCard`, las dos cards de Inicio) y `elevation.high` (hojas, hacia arriba) en `src/theme/elevation.ts`, con `colors.shadow`. Lo que lleva sombra necesita un fondo **opaco** (`surfaceRaised`, no `surfaceTint`): en Android la sombra se vería a través de un fondo translúcido. El resto de la jerarquía sigue siendo **superficies tonales** (`surfaceTint`, sin borde), **rellenos** (`primary`, `accent`) y **espacio**; los **controles** conservan el borde `outline` 1 px.
- Cards decorativas: fondo `surfaceTint`, radio `lg`, sin borde. Campos: fondo `surface`, borde `outline`, radio `md`.
- Hojas modales: `Sheet` desde abajo, `overlay`, esquinas superiores de 24, `maxHeight 85 %`, `accessibilityViewIsModal`.

### 3.5 Iconografía

- **Ionicons** (`@expo/vector-icons`), mayoritariamente variante *outline* (`home-outline`, `library-outline`, `calendar-outline`, `stats-chart-outline`, `person-outline`, `create-outline`, `pencil-outline`, `trash-outline`, `timer-outline`, `flag-outline`, `cloud-offline-outline`, `book-outline`, `list-outline`/`grid-outline`, `chevron-*`, `add`).
- Tamaños siempre por `iconSize.*`. Los iconos decorativos van con `accessible={false}`.
- Los iconos informativos usan `primary` o `textSecondary`; **nunca** `accent` sobre fondo claro.

### 3.6 Movimiento

- **Movimiento (2026-10-14), solo con `Animated` de React Native y sin librerías:** latido de los skeletons; `PressableScale` (resorte corto al pulsar botones y cards, `pressScale` 0,97); `FadeIn` (entrada escalonada de las secciones de Inicio: la **única coreografía**); `ReadingProgress` anima su relleno al cambiar; y las transiciones nativas de navegación y de las hojas.
- **Respetar «reducir movimiento»** (`AccessibilityInfo.isReduceMotionEnabled`): sin animación cuando está activo (ya lo hace `SkeletonPulse`; cualquier animación nueva debe hacerlo).
- **Toda animación consulta `useReducedMotion`** y, si está activo, muestra el estado final sin movimiento. No se añade una librería de animación sin consultar.

### 3.7 Navegación y cromo

- **Barra de pestañas inferior** (React Navigation `bottom-tabs`): 5 pestañas — Inicio, Biblioteca, Calendario, Estadísticas, Mi espacio; activa `primary` con **icono relleno**, inactiva `textSecondary` con icono *outline*; fondo del lienzo, filo `border` y etiquetas `xs` semibold. Su apariencia está en `src/navigation/chrome.ts` (`tabBarOptions`).
- **Encabezados** de React Navigation (título + volver) con `headerOptions` de `chrome.ts`: sin sombra, fondo del lienzo, título `lg` bold y acciones en `primary`; además tematizados desde `App.tsx`. El stack de la app oculta el encabezado en `Tabs` y lo muestra en las pantallas secundarias; las pestañas muestran el suyo con su título.
- El arranque usa `StartupScreen` (logo sobre Porcelain, igual que la pantalla de inicio nativa).

---

## 4. Patrones de diseño vigentes

| Patrón | Cómo se resuelve hoy |
|---|---|
| Acción principal | Un solo botón relleno `primary` por pantalla; las alternativas son `secondary` (borde `primary`); lo destructivo es `danger` (borde `error`) |
| Selección | `Chip` (borde `outline`; seleccionado = relleno `primary`). Estado nunca solo por color |
| Listas | Fila o card con borde; estados cargando/vacío/error; `FlatList` |
| Formularios | `TextField` con etiqueta encima (sm, semibold), campo ≥ 48 de alto, borde `outline`, error en `error` + `accessibilityRole="alert"` |
| Hojas | `Sheet` modal inferior para elegir (libro, fecha), ajustar (página, meta) y filtrar |
| Progreso | `ReadingProgress`: barra de 6 px, pista `border`, relleno `primary`, etiqueta `n %` opcional |
| Estado vacío | `EmptyState`: icono 56 `textSecondary` + título lg bold + (acción) |
| Carga | Silueta con la forma exacta (`Skeleton` + `SkeletonPulse`) |
| Datos numéricos | `StatTile` (cifra lg bold + nombre sm), `GoalProgress` (resumen + barra + estado con icono y texto) |
| Gráficos | `DailyBars`: barras propias con `View` (sin librería), no interactivas, con descripción accesible |

---

## 5. Inventario de componentes (`src/components/`)

> «Pintan, no acceden a datos» salvo indicación. Todos usan solo tokens.

| Componente | Qué es y cómo se ve hoy | Dónde se usa |
|---|---|---|
| `Button` | Alto ≥ 48, radio `md`, padding horizontal `lg`; variantes `primary`, `secondary`, `danger`, `google`; `loading` muestra spinner dentro | Casi todas las pantallas |
| `TextField` | Etiqueta + campo (borde `outline`, radio `md`); `secureTextEntry` incluye ojo; `action` opcional (p. ej. cámara); estado deshabilitado atenuado | Formularios |
| `Chip` | Etiqueta pulsable ≥ 48, borde `outline`, seleccionado relleno `primary` | Filtros, estados, vistas, tipo de meta |
| `StatusSelector` | Cinco chips de estado (Quiero leerlo, Leyendo, En pausa, Terminado, Abandonado) | Detalle y formulario de libro |
| `BookCard` | Portada + título, autores, insignia de estado y progreso (solo si lee/pausa y hay páginas); variantes `list` y `grid` | Biblioteca |
| `BookCover` | Portada 2:3, radio `sm`; sin portada: iniciales sobre color de la paleta estable por título | Tarjetas, detalle |
| `BookFilters` | Búsqueda + chips de estado + hoja de filtros (género, autor, saga) | Biblioteca |
| `BookForm` | Formulario compartido añadir/editar (título, autores, ISBN con búsqueda y cámara, páginas, géneros, saga, orden, estado) | Añadir/Editar libro |
| `SuggestionList` | Lista de sugerencias en el flujo del formulario (no flotante) | Campo Saga |
| `ReadingProgress` | Barra de progreso (ver §4) | Detalle, tarjetas, metas |
| `GoalProgress` | «12 min de 30 min» + barra + estado («Faltan…» / «Meta cumplida» con icono); opcionalmente pulsable | Inicio, Estadísticas, Calendario |
| `SetGoalLink` | Enlace con icono de bandera «Fijar meta diaria» | Inicio, Estadísticas |
| `DailyGoalSheet` | Hoja: elegir Minutos/Páginas (chips), valor, Guardar, Quitar meta | Inicio, Estadísticas |
| `SessionRow` | Fila de sesión: título + detalle + notas; opcional chevron (abre) y lápiz/papelera (editar/eliminar), cada uno 48×48 | Inicio, Calendario, Detalle del libro |
| `PickerRow` | Campo que se elige en una hoja (parece un `TextField`) | Registrar lectura, Cronómetro |
| `PeriodHeader` | Flechas ‹ › y título del periodo (mes/semana/año/día) | Calendario, Estadísticas |
| `MonthCalendar` | Cuadrícula lunes-domingo; hoy con anillo, elegido relleno `primary`, día de lectura con punto | Calendario, selector de fecha |
| `DatePickerSheet` / `BookPickerSheet` | Hojas que envuelven calendario / lista de libros | Registrar lectura |
| `Sheet` | Hoja modal inferior (ver §3.4) | Todas las hojas |
| `EmptyState` | Estado vacío o de error (ver §4) | Todas |
| `AuthLayout` | Contenedor de Login/Registro: marca (logo + «Lectoria»), teclado, scroll, área segura | Login, Registro |
| `GoogleSignInButton` | Botón claro con borde `outline` y logo multicolor de Google (el logo no se altera) | Login, Registro |
| `StartupScreen` | Logo centrado sobre Porcelain | Arranque |
| `Skeleton`, `SkeletonPulse` + `LibrarySkeleton`, `BookDetailSkeleton`, `BookFormSkeleton`, `SessionListSkeleton`, `HomeSkeleton`, `CalendarSkeleton`, `StatisticsSkeleton`, `TimerSkeleton` | Siluetas de carga por pantalla | Cada pantalla |

Componentes **propios de una pantalla** (no en `components/`): `ReadingActions` (`RegisterCard`, `TimerCard`, `CardBadge`) en Inicio; `WeekView`, `YearView`, `DaySessions` en Calendario; `StatTile`, `DailyBars` en Estadísticas; `ProgressAdjustSheet` en el detalle del libro.

**Colores de estado del libro (`BookCard`):** Quiero leerlo = borde y texto `primary`, sin relleno · Leyendo = relleno `primary` · En pausa = relleno `accent` · Terminado = relleno `textPrimary` con texto `background` · Abandonado = borde y texto `textSecondary`. Siempre acompañados del **texto** del estado.

---

## 6. Inventario de pantallas (`src/screens/`)

Estructura de navegación: **Auth** (Login, Registro) → tras iniciar sesión, **App**: pestañas (Inicio, Biblioteca, Calendario, Estadísticas, Mi espacio) + pantallas secundarias en stack (AddBook, ScanBook, AddSession, Timer, BookDetail, EditBook).

| Pantalla | Qué muestra hoy (de arriba abajo) | Estados |
|---|---|---|
| **Login / Registro** | Marca (logo + «Lectoria») · campos (Registro: nombre, apodo opcional) · botón principal · «Continuar con Google» · botón secundario hacia la otra pantalla («Crear una cuenta»). Sin títulos | Error en línea; spinner en el botón |
| **Inicio** | **Racha** (cifra 56 en `primary`, «días seguidos», récord) · **Meta diaria** (`GoalProgress` o «Fijar meta diaria») · **dos cards**: «Registrar lectura» (relleno `primary`) y «Cronómetro» (fondo claro; muestra el tiempo y «Leyendo/En pausa» si hay uno) · **Actividad reciente** (5 `SessionRow` que abren el libro) | Skeleton · error con «Reintentar» · «Añade tu primer libro» · actividad vacía |
| **Biblioteca** | Encabezado con «+» · búsqueda y chips de estado · conmutador lista/cuadrícula · libros (`BookCard`, 2 columnas en cuadrícula) | Skeleton · error · «Tu biblioteca está vacía» · «Ningún libro coincide» |
| **Detalle del libro** | Portada 112 + título (xl bold) + autores · `StatusSelector` · «Página X de Y» + barra (toca para ajustar) · filas de detalle (géneros, saga, empezado, terminado) · **«Registrar lectura»** (primario) · sección **Lecturas** (total, nº de sesiones, filas con editar/eliminar, «Mostrar más») · Editar (secundario) · Eliminar (`danger`) | Skeleton · error · «Este libro ya no existe» |
| **Añadir / Editar libro** | `BookForm`; en «Añadir», botón de cámara en el campo ISBN y «Buscar por ISBN» | Skeleton del formulario · errores por campo |
| **Escáner** | Cámara (`expo-camera`, solo EAN-13) | Sin permiso: `EmptyState` con «Permitir» / «Abrir ajustes» |
| **Registrar / Editar lectura** | `PickerRow` Libro · `PickerRow` Fecha (hoy o cualquier día pasado) · Minutos · (Página inicial, solo si es otro día o al editar) · Página final / «en la que vas» · Notas · «Guardar». Desde el cronómetro: minutos **bloqueados** (campo atenuado) | Skeleton · «Este libro/lectura ya no existe» · «Añade un libro…» |
| **Cronómetro** | `PickerRow` Libro · reloj de 56 con cifras tabulares (+ «En pausa») · Iniciar / Pausar / Reanudar (primario) · Finalizar (secundario) · Descartar (`danger`) | Skeleton · sin libros · error |
| **Calendario** | Chips Semana/Mes/Año (+ «Hoy») · vista elegida (**Semana**: 7 filas con barra proporcional y marca de meta; **Mes**: cuadrícula con puntos; **Año**: 12 recuadros) · **detalle del día** (`DaySessions`: total, meta, sesiones con editar/eliminar, «Registrar lectura») | Skeleton · error |
| **Estadísticas** | Chips **Día/Mes** (+ «Hoy») · `PeriodHeader` · **Día**: 3 `StatTile` (tiempo, páginas, sesiones) + meta · **Mes**: 4 `StatTile` (tiempo, páginas, días de lectura, libros terminados) + gráfico de barras por día (rellena = meta cumplida, hueca = no cumplida, línea de meta, leyenda) + cumplimiento de la meta + racha | Skeleton · error · «Registra tu primera lectura» |
| **Mi espacio** | Correo · «Métodos de acceso» (Google y Correo/contraseña, vincular) · «Cerrar sesión» | — |

---

## 7. Funcionalidades

### 7.1 Implementadas (versión 1.0, Fases 1–5 cerradas)

- **Cuenta:** registro/login con correo (nombre y apodo) y con Google; sesión persistente; vincular métodos de acceso.
- **Biblioteca:** añadir (manual o por ISBN con Open Library, o escaneando el código de barras), editar, eliminar, cambiar estado, buscar y filtrar (estado, género, autor, saga), lista/cuadrícula, aviso de duplicados, sugerencias de saga.
- **Lecturas:** registrar manualmente (hoy o día pasado, con página inicial en lecturas de otro día), con **cronómetro** (marcas de tiempo, sigue en segundo plano, se recupera si la app se cierra, no duplica), editar y eliminar; el progreso del libro se mantiene solo.
- **Calendario:** semana, mes y año; detalle por día; registrar desde un día.
- **Rachas:** actual y récord.
- **Meta diaria:** en **minutos o páginas**, con progreso en Inicio, Estadísticas y Calendario.
- **Estadísticas:** por día y por mes (tiempo, páginas, sesiones, días de lectura, libros terminados, gráfico diario, cumplimiento de la meta, racha).
- **Datos privados** por usuario (reglas de Firestore).

### 7.2 Planificadas (**no existen**; el diseño debe dejar espacio coherente, no implementarlas)

Según el plan de desarrollo (`BookTracker_Plan_de_desarrollo.md`):

| Versión | Funciones |
|---|---|
| **1.1** | Lista de deseos, libros comprados, **notas y reseñas** (valoración 1–5). *El modelo ya tiene campos `rating`, `review`, `notes`, `acquisition`, pero no hay interfaz.* |
| **1.2** | **Autores, sagas, colecciones personalizadas**, estanterías filtradas (pantallas «Detalle de saga», «Detalle de autor», «Crear colección») |
| **1.3** | **Ruleta de no leídos**, **logros** (insignias: primer libro, 7 días seguidos, 10 libros…), **estantería realista** (lomos sobre baldas con alturas, grosores y colores derivados de los metadatos) |
| **1.4** | Recordatorios locales, calendario avanzado, estimaciones de lectura (tiempo restante) |
| **1.5** | Estadísticas ampliadas, exportación de datos, accesibilidad ampliada |

### 7.3 Pendientes o aplazados (decisiones abiertas)

- **Tema oscuro** (decisión pendiente) y variante del logo para fondo oscuro.
- **Objetivo mensual en libros** (aplazado a 1.1).
- Estadísticas de **géneros y autores más leídos** y resumen anual propio.
- **Inicio:** el plan lista además un saludo con resumen y los libros en lectura (no implementados).
- **«Mi espacio» ampliado:** perfil, objetivos, preferencias, notificaciones, ajustes (hoy solo cuenta y cerrar sesión).
- **iOS** (probado solo en Android), comportamiento sin conexión, borrado completo de cuenta.

> Al rediseñar, **no inventes pantallas ni datos** de §7.2/§7.3. Si propones un hueco en la navegación o en una pantalla para ellos, márcalo como *propuesta*.

---

## 8. Responsividad

- **Móvil, solo vertical** (`orientation: "portrait"`); referencia de diseño: **360–430 pt de ancho**. iOS declara `supportsTablet`, pero no hay diseño específico para tableta.
- Layout con **flexbox** y anchos relativos (`flex: 1`, `%`); evitar anchos fijos salvo portadas (`BookCover` calcula su alto con la proporción 2:3).
- **Cuadrícula de la biblioteca:** 2 columnas fijas (`numColumns` no cambia en caliente: la lista se remonta al alternar).
- **Texto escalable** hasta lo que permita el sistema: nada de alturas fijas en contenedores de texto; los botones y cards crecen con el contenido (`minHeight`, no `height`).
- **Teclado:** `KeyboardAvoidingView behavior="padding"` con `keyboardVerticalOffset` calculado (`useWindowTop`); las hojas con campos se levantan solas.
- **Áreas seguras:** respetadas arriba y abajo (encabezados, barra de pestañas, hojas).
- Probar mentalmente al menos: 360 pt de ancho, fuente al 130 % y al máximo del sistema, y un teléfono con barra de gestos.

---

## 9. Accesibilidad (obligatoria)

- **Contraste:** texto ≥ 4,5:1; bordes de controles y gráficos ≥ 3:1 (por eso los controles usan `outline`, no `border`).
- **Zonas táctiles ≥ 48 pt** sin depender de `hitSlop` (excepción: iconos pequeños con `hitSlop` que lleguen a 44).
- Todo control con `accessibilityRole` y `accessibilityLabel`; estado comunicado **también por texto, icono o relleno, nunca solo por color** (p. ej. la meta cumplida lleva icono + «Meta cumplida»; el gráfico distingue barra rellena y hueca).
- Errores con `accessibilityRole="alert"`; hojas con `accessibilityViewIsModal`; imágenes decorativas `accessible={false}`.
- Gráficos como imagen accesible con una frase que resume lo que se ve (`describeMonthChart`).
- Reloj del cronómetro con `accessibilityRole="timer"` y el tiempo dicho en palabras.
- «Reducir movimiento» respetado; texto que escala con el sistema.
- Skeleton anunciado como un único elemento «Cargando …».

---

## 10. Diagnóstico visual: dónde modernizar

Observaciones **derivadas del código antes del primer pase de rediseño (2026-10-14)**, para priorizar (no son bugs). El §16 recoge cuáles ya se atendieron:

1. **Superficies planas:** `surface` = `background`. Todo se separa con bordes de 1 px; las cards y los campos casi no se distinguen del fondo. Falta un nivel de profundidad.
2. **Jerarquía tipográfica corta:** cinco tamaños y tres pesos con fuente del sistema; los títulos de sección (Actividad reciente, Lecturas, Minutos por día) son solo texto `lg bold`. No hay un estilo de título de pantalla propio (se usa el encabezado por defecto de React Navigation).
3. **Cromo por defecto:** barra de pestañas y encabezados son los de React Navigation sin personalizar (no hay identidad en esas zonas).
4. **Formas uniformes:** casi todo con radio 12 y borde de 1 px; poca variación entre controles, cards y contenedores.
5. **Iconografía:** solo *outline* de Ionicons; la identidad dorada aparece únicamente en las cards de Inicio y en algunas insignias.
6. **Biblioteca:** las tarjetas son funcionales pero sobrias; la portada es el único elemento visual rico.
7. **Estadísticas y Calendario:** correctos y accesibles, pero densos y muy «de tabla»; el gráfico es mínimo.
8. **Pantallas de autenticación:** muy desnudas (logo + campos).
9. **Estados vacíos:** icono genérico + título; sin ilustración ni calidez de marca.

---

## 11. Directrices concretas de rediseño

**Principio rector:** *más calidez y profundidad, menos ruido*. Modernizar = mejor jerarquía, mejores superficies, mejor ritmo, microinteracciones discretas. **No** = más elementos, más texto ni más colores.

### 11.1 Qué hacer

1. **Introducir profundidad sin sombras ajenas a la paleta.** Propón un **token de superficie elevada** derivado de la paleta (p. ej. una mezcla muy ligera de Porcelain con Evergreen/Hunter Green vía `withAlpha`/mezcla) para cards y campos, distinto de `background`. Mantén contraste de texto y bordes (§2.3) y **actualiza `colors.test.ts`** si añades pares. Si propones sombras suaves, defínelas como **tokens** (`elevation`) y verifica Android e iOS.
2. **Ampliar la escala de forma de manera coherente:** hoy `radius` `sm 8`/`md 12`. Puedes proponer un radio mayor para cards y hojas (p. ej. 16–20) y uno «píldora» para chips/insignias, **como tokens**.
3. **Reforzar la jerarquía tipográfica** con los tokens existentes (y, si lo consideras necesario, **proponer** nuevas entradas de `fontSize`/`fontWeight` o una fuente propia, esperando aprobación): un estilo de **título de pantalla**, uno de **título de sección** y cifras destacadas (racha, tiempo) más protagonistas. Cifras numéricas siempre con `tabular-nums`.
4. **Personalizar el cromo:** estilo de la barra de pestañas (indicador del ítem activo, tamaño de iconos, etiquetas) y de los encabezados usando los tokens; mantener los **5 destinos** y los iconos *outline* (puedes proponer variante rellena para el activo).
5. **Usar el dorado (`accent`) como firma de marca**, siempre como **fondo con `onAccent` encima** (círculos, insignias, resaltes, hitos como racha o meta cumplida). Nunca como texto sobre Porcelain.
6. **Inicio:** conservar el orden de importancia (racha → meta → registrar/cronómetro → actividad) y las **dos cards independientes** (no agruparlas en un contenedor ni volver a botones). Mejorar presencia de la racha, ritmo vertical y calidez; el cronómetro activo debe destacar más.
7. **Biblioteca / detalle:** dar protagonismo a la portada (proporción 2:3), mejorar la `BookCard` (jerarquía título/autor/estado/progreso) y la composición del detalle (cabecera, progreso, lecturas). Mantener las insignias de estado con texto.
8. **Calendario y Estadísticas:** más aire entre bloques, tiles con jerarquía clara, gráfico más legible (etiquetas de eje, línea de meta, énfasis del día actual) **sin interacción por barra** (cada barra mide < 48 pt) y manteniendo distinción por forma (relleno/hueca).
9. **Estados vacíos y de error:** darles identidad (composición con el logo/dorado, icono más cuidado), siempre icono/ilustración + título + (acción); **sin párrafos de ayuda**.
10. **Autenticación:** una pantalla más acogedora (marca, jerarquía, ritmo), **sin añadir títulos ni subtítulos de relleno** y manteniendo el botón de Google con fondo claro y borde `outline`.
11. **Microinteracciones discretas** (estado presionado, transiciones de hojas, aparición de listas) que respeten «reducir movimiento» y sin librería nueva salvo aprobación.
12. **Preparar el terreno para lo planificado** (§7.2): reservar patrones reutilizables para tarjetas de logro, filas de reseña/valoración, cabeceras de saga/autor y baldas de estantería, **sin diseñarlas como funciones ya existentes**.

### 11.2 Qué NO hacer

- No añadir colores fuera de la paleta + error. No usar `accent` como texto/icono informativo sobre claro.
- No convertir las dos cards de Inicio en botones ni agruparlas.
- No quitar skeletons ni sustituirlos por spinners de pantalla completa; no dejar un skeleton con medidas distintas al componente real.
- No añadir títulos, subtítulos, textos de ayuda ni controles «por si acaso».
- No reducir zonas táctiles por debajo de 48 pt ni depender de `hitSlop`.
- No comunicar estado solo con color.
- No introducir lógica nueva, llamadas a Firebase ni cambios de modelo desde componentes de presentación.
- No tocar `src/services`, `src/hooks`, `src/context`, `firestore.rules` ni `src/utils` salvo para exponer un dato de presentación imprescindible (y entonces, con prueba).
- No cambiar los iconos nativos ni la configuración de `app.json` sin avisar (requiere build de EAS).

### 11.3 Cómo aplicar los cambios (orden recomendado)

1. **Tokens** (`src/theme/*`): superficies, radios, escala tipográfica, y cualquier token nuevo. Ejecutar las pruebas de tokens y contrastes.
2. **Primitivas** de `components/`: `Button`, `TextField`, `Chip`, `Sheet`, `EmptyState`, `Skeleton*` (y sus medidas).
3. **Cromo de navegación** (`TabNavigator`, opciones de encabezado en `AppNavigator`, tema en `App.tsx`).
4. **Pantallas por prioridad de uso:** Inicio → Registrar lectura/Cronómetro → Biblioteca y detalle → Calendario → Estadísticas → Autenticación → Mi espacio.
5. **Skeletons:** después de cada pantalla, igualar sus medidas.

---

## 12. Cómo entregar y verificar

**Entrega esperada** (sobre el repositorio, sin reescrituras):

1. Los cambios de código en `src/theme/*`, componentes y pantallas.
2. Un resumen: qué token/componente/pantalla cambió, **por qué**, y qué decisiones requieren aprobación (fuentes, sombras, tema oscuro, dependencias).
3. Capturas o descripción de antes/después de las pantallas tocadas, con el criterio de accesibilidad aplicado.
4. Lista de pruebas actualizadas (si se añaden tokens o pares de color).

**Verificación obligatoria antes de dar algo por terminado** (todo se ejecuta, no se supone):

```bash
npm run typecheck          # tsc --noEmit
npm test                   # incluye designTokens.test.ts, colors.test.ts y readme.test.ts
npx expo export --platform android   # el bundle compila
npx expo-doctor            # diagnóstico de dependencias
```

- `npm run test:rules` solo hace falta si se tocan servicios o reglas (no deberías).
- Las pantallas **no tienen pruebas de interfaz** (no se usa `@testing-library/react-native`): hay que **revisar visualmente en dispositivo/Expo Go** y decir explícitamente lo que no se pudo ver.
- No hacer `git commit` ni `push`; proponer un título de commit.

---

## 13. Skills de diseño recomendadas (y cómo instalarlas)

> **Importante:** estas skills **no están instaladas en el proyecto**. Claude Design debe descargarlas, revisarlas y aplicarlas siguiendo esta sección. La existencia de los repositorios y de los nombres de skill fue **verificada en GitHub** el 2026-10-14; **el contenido concreto de cada `SKILL.md` debe leerse antes de usarla**.
>
> **Limitación clave:** la mayoría de las skills de diseño disponibles están pensadas para **web (HTML/CSS/React DOM)**; Lectoria es **React Native** (sin CSS). Úsalas como **método y criterio de diseño**, nunca copies sus plantillas ni su código tal cual.

### 13.1 Skills recomendadas, por utilidad para este proyecto

| Prioridad | Skill | Origen | Para qué sirve en Lectoria | Cautela |
|---|---|---|---|---|
| **1 · Alta** | `frontend-design` | [`anthropics/skills`](https://github.com/anthropics/skills) (`skills/frontend-design`) | Criterio para evitar interfaces genéricas: composición, jerarquía, tipografía, detalle y movimiento | Es **web**. Aplica el método, no el código. **No** dejes que cambie la paleta ni añada fuentes por su cuenta |
| **1 · Alta** | `react-native-guidelines` | [`vercel-labs/agent-skills`](https://github.com/vercel-labs/agent-skills) | Buenas prácticas de **React Native/Expo**: layout, áreas seguras, teclado, animación, rendimiento de listas | Ajustada a performance y arquitectura; no a estética. El nombre de carpeta puede ser `react-native-skills`: comprobarlo |
| **2 · Media** | `web-design-guidelines` | `vercel-labs/agent-skills` | **Auditoría** de accesibilidad y UX (100+ reglas) como lista de comprobación | Es **web**: ignora lo específico de DOM/CSS y quédate con accesibilidad, formularios, estados y animación |
| **2 · Media** | `skill-creator` | `anthropics/skills` | **Convertir esta guía en una skill propia del proyecto** (`lectoria-design`) para que futuras sesiones respeten el sistema visual | Ver §13.3 |
| **3 · Baja** | `brand-guidelines` | `anthropics/skills` | **Plantilla de estructura** para documentar identidad de marca (la skill es de la marca Anthropic; no uses sus colores) | Solo como modelo de formato |
| **3 · Baja** | `canvas-design` | `anthropics/skills` | Crear **piezas gráficas estáticas** (p. ej. ilustraciones de estados vacíos, variante de logo, capturas de tienda) | Cualquier cambio de icono nativo exige build de EAS; ilustraciones nuevas = assets nuevos (consultar) |
| **Opcional** | `web-artifacts-builder` | `anthropics/skills` | **Prototipar pantallas en HTML** para comparar variantes antes de portarlas a React Native | Es solo prototipo: luego hay que reescribirlo con `StyleSheet` y tokens |
| **Opcional** | `dataviz` | *Si está disponible en tu entorno* | Criterio para el **gráfico de barras** de Estadísticas (color, ejes, accesibilidad) | Debe respetar la paleta de Lectoria y la regla «sin interacción por barra» |

**No recomendadas para este proyecto:** `theme-factory` (aplica temas predefinidos; aquí la paleta es **fija** y propia), `algorithmic-art`, `webapp-testing` (testing web), `docx`/`pdf`/`pptx`/`xlsx`, `slack-gif-creator`, `mcp-builder`, `internal-comms`, `claude-api`.

### 13.2 Instalación (Claude Design las descarga e implementa)

Si tu entorno admite plugins/skills (Claude Code o equivalente), usa **estas vías verificadas**:

```bash
# Skills de Anthropic (frontend-design, skill-creator, brand-guidelines, canvas-design, web-artifacts-builder…)
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills

# Skills de Vercel (react-native-guidelines, web-design-guidelines…)
npx skills add vercel-labs/agent-skills
```

- **Instalación manual alternativa:** cada skill es una carpeta con un `SKILL.md` (y, a veces, `scripts/` y `references/`). Cópiala a `.claude/skills/<nombre>/` (proyecto) o `~/.claude/skills/<nombre>/` (personal).
- **Si el entorno no admite instalar skills:** descarga los `SKILL.md` de los repositorios y úsalos como **documentos de referencia** durante el rediseño.
- **Comprueba qué se instaló** (que `frontend-design` esté dentro de `example-skills`, y el nombre real de la skill de React Native) antes de afirmar que está disponible.

**Seguridad (obligatorio antes de activar nada):**

1. Lee cada `SKILL.md` y **todo script** que incluya; **no ejecutes scripts** que no hayas leído.
2. Fija la versión (commit) si es posible y no instales skills de terceros no listados aquí.
3. Una skill **nunca anula** las reglas de §2 ni las de `CLAUDE.md`. Si una skill sugiere algo que las contradice (otra paleta, otra librería, más texto de ayuda), **gana esta guía**.
4. No introduzcas dependencias de proyecto porque una skill las sugiera: proponlas y espera aprobación.

### 13.3 Cómo implementarlas en el proyecto

1. **Antes de diseñar:** aplica `frontend-design` para fijar la *dirección estética* dentro de las restricciones (paleta cerrada, minimalismo). Resume la dirección en 5–8 líneas y confírmala.
2. **Mientras codificas:** consulta `react-native-guidelines` para layout, teclado, áreas seguras, animación y rendimiento de `FlatList`.
3. **Antes de entregar:** pasa `web-design-guidelines` como **auditoría** (accesibilidad, formularios, estados, movimiento), descartando lo que sea solo web.
4. **Al terminar:** con `skill-creator`, crea una skill de proyecto **`lectoria-design`** (en `.claude/skills/lectoria-design/SKILL.md`) que **resuma §2, §3, §4, §9 y §11.2** de esta guía y enlace al documento completo. Así cualquier sesión futura aplica el sistema visual sin releerlo todo. Mantén su descripción corta y enfocada a *cuándo usarla* (cambios de interfaz en Lectoria).
5. **Registra** en tu resumen de entrega qué skills se usaron, para qué, y cuáles se descartaron por ser solo web.

---

## 14. Mapa de archivos relevantes

```text
App.tsx                          Providers y tema de navegación (colores del encabezado)
src/theme/                       colors.ts · spacing.ts · typography.ts  (+ pruebas de tokens y contraste)
src/components/                  Primitivas y componentes compartidos (ver §5) y skeletons
src/navigation/                  TabNavigator.tsx (barra de pestañas) · AppNavigator.tsx (stack y encabezados) · AuthNavigator.tsx · types.ts
src/screens/auth/                LoginScreen · RegisterScreen
src/screens/app/home/            HomeScreen · ReadingActions (cards) 
src/screens/app/library/         LibraryScreen · BookDetailScreen · AddBook/EditBook/ScanBook · ProgressAdjustSheet
src/screens/app/reading/         AddSessionScreen · TimerScreen
src/screens/app/calendar/        CalendarScreen · WeekView · YearView · DaySessions
src/screens/app/statistics/      StatisticsScreen · StatTile · DailyBars
src/screens/app/profile/         ProfileScreen
assets/                          logo.png (dentro de la app) · icon/splash/adaptive (nativos: exigen build) · google-g.png
docs/palette-original.txt        Paleta original
BookTracker_Plan_de_desarrollo.md  Plan: alcance, modelo de datos, fases y pendientes
CLAUDE.md                        Convenciones del proyecto (no versionado)
```

**No son de diseño (no tocar):** `src/services/`, `src/hooks/`, `src/context/`, `src/utils/` (lógica pura y probada), `firestore.rules`, `tests/rules/`.

---

## 15. Checklist de aceptación del rediseño

- [ ] No hay colores, `fontSize`, `opacity` ni tamaños de icono escritos fuera de `src/theme/` (`designTokens.test.ts` en verde).
- [ ] Paleta cerrada: ningún hex nuevo fuera de los cinco + error (`colors.test.ts` en verde); contrastes ≥ 4,5:1 (texto) y ≥ 3:1 (controles y gráficos).
- [ ] Toda zona táctil ≥ 48 pt; todo control con rol y nombre accesible; estado nunca solo por color.
- [ ] Cada pantalla conserva su **acción principal única** y no gana textos de ayuda ni controles nuevos.
- [ ] Estados **cargando, vacío y error** presentes y coherentes; **skeletons con las mismas medidas** que los componentes reales.
- [ ] Las dos cards de Inicio siguen siendo cards **independientes**.
- [ ] «Reducir movimiento» respetado en cualquier animación nueva.
- [ ] Sin cambios en lógica, servicios, hooks, contexto, modelos ni reglas; sin dependencias nuevas no aprobadas.
- [ ] `npm run typecheck`, `npm test`, `npx expo export --platform android` y `npx expo-doctor` ejecutados y reportados con sus resultados reales.
- [ ] Se indica expresamente qué no se pudo verificar en dispositivo.
- [ ] Skills usadas/descartadas listadas, y skill de proyecto `lectoria-design` creada (o propuesta).

---

## 16. Registro del rediseño aplicado (primer pase, 2026-10-14)

Primer pase de rediseño hecho siguiendo esta guía (§11). **Verificado:** tipos, 559 pruebas unitarias (incluidas las de tokens y contraste) y compilación del bundle de Android. **No verificado:** el aspecto en dispositivo (no hay pruebas de interfaz): hay que revisarlo visualmente antes de darlo por bueno.

| Guía | Qué se hizo |
|---|---|
| §11.1.1 Profundidad | Token `surfaceTint` (Hunter Green al 7 %) para cards y bloques decorativos, sin borde ni sombra. Contraste de texto sobre él verificado en `colors.test.ts` |
| §11.1.2 Formas | Escala `radius`: `sm` 8, `md` 12, `lg` 18, `pill`. Botones `lg`; chips, etiquetas de estado y barras en píldora; campos siguen en `md` |
| §11.1.4 Cromo | `src/navigation/chrome.ts`: encabezados sin sombra con título bold y barra de pestañas con filo sutil, etiquetas con peso e **icono relleno en la pestaña activa** |
| §11.1.5 Dorado de marca | Círculo `accent` con icono en la **racha de Inicio** (llama) y en el avatar de «Mi espacio»; `accentSoft` en los estados vacíos |
| §11.1.6 Inicio | La racha es el único elemento «grande»: cifra de 56 + círculo dorado sobre superficie tonal; la meta en bloque tonal; las dos cards independientes con esquinas `lg`, y la del cronómetro se enmarca en `primary` cuando hay uno activo |
| §11.1.7 Biblioteca/detalle | `BookCard` tonal con etiqueta de estado en píldora; el progreso y los datos del detalle en bloques tonales |
| §11.1.8 Calendario/Estadísticas | Filas de Semana, recuadros de Año y `StatTile` tonales; el marco de selección ocupa siempre su sitio (borde transparente → `primary`) |
| §11.1.9 Vacíos | `EmptyState` con el icono en un círculo `accentSoft` |
| §11.1.10 Autenticación | Marca centrada y logo más grande |
| Hojas | `Sheet` con asa de arrastre |
| Skeletons | Igualados a los componentes nuevos (chips en píldora, bloques tonales, racha con círculo, reloj tonal, tiles con esquinas `lg`) |

**Pendiente de este pase (no hecho):** tipografía propia (requiere fuente y aprobación), sombras o `elevation`, microinteracciones nuevas, tema oscuro, y la reordenación de contenidos de Biblioteca y Estadísticas más allá de las superficies.

---

## 17. Registro del segundo pase (2026-10-14)

Con permiso expreso para tipografía propia, sombras, tema oscuro y animaciones nuevas. **Verificado:** tipos, 599 pruebas unitarias (incluidas las de tokens, tipografía y contraste de **ambos temas**), compilación del bundle de Android con las 5 fuentes empaquetadas y `expo-doctor` 21/21 tras actualizar Expo a 57.0.29. **No verificado:** el aspecto y el movimiento en dispositivo, el tema oscuro (necesita un build nuevo de EAS por `userInterfaceStyle`) y la carga real de las fuentes.

| Tema | Qué se hizo |
|---|---|
| Tipografía | Figtree + Literata; el peso se expresa con `fontFamily.*` (38 archivos migrados) y dos guardas en `designTokens.test.ts` |
| Sombras | `elevation.low` en `BookCard` y las cards de Inicio; `elevation.high` en `Sheet`; `surfaceRaised` opaca para lo que lleva sombra |
| Tema oscuro | `lightColors` / `darkColors` derivados de la paleta, activo según el sistema al abrir la app; marca clara fija (logo sobre losa, arranque y botón de Google) |
| Movimiento | `PressableScale`, `FadeIn` (Inicio), relleno animado de `ReadingProgress`; todo con `useReducedMotion` |
| Pulido | Buscador de Biblioteca en píldora, gráfico y cumplimiento de la meta de Estadísticas en tarjetas tonales, vacío de «Actividad reciente» con círculo de marca, filo en la portada de reemplazo |

**Pendiente:** pantalla de arranque nativa oscura (necesita una variante del logo); reordenación de contenidos de Biblioteca y Estadísticas más allá de las superficies.

---

## 18. Registro del panel de Configuración (2026-10-14)

Petición: tuerca arriba a la derecha que abre un panel lateral (mitad de la pantalla) con fondo desenfocado y un selector de tema claro/oscuro, aplicado a toda la app sin recargar y persistido. Se autorizó `expo-blur` por el requisito de *backdrop blur*.

| Tema | Qué se hizo |
|---|---|
| Tema en vivo | `ThemeProvider` / `useTheme()` / `makeStyles((colors) => ...)`: 44 archivos pasaron de estilos fijos al importar a estilos que dependen del tema; `colors.ts` solo exporta `lightColors`, `darkColors`, `palette` y `ColorTokens` |
| Persistencia | `utils/themeMode.ts` (`parseThemeMode`, `resolveThemeMode`) y AsyncStorage `lectoria.theme`; sin elección guardada, el del sistema |
| Panel | `SettingsPanel` (carcasa) + `SettingsContext`; capa superpuesta en la raíz con `BlurTarget`/`BlurBackdrop`; ancho por `utils/settingsPanel.getPanelWidth`; cierre por fuera, X y «atrás»; animación con `useReducedMotion` |
| Escalable | Secciones en `components/settings/` (`SettingsSection`, `AppearanceSection`): una opción nueva es una sección nueva |
| Acceso | `SettingsButton` como `headerRight` de las 5 pestañas; Biblioteca muestra «+» y la tuerca a su derecha |

**Decisión de contraste:** el panel usa `background` y no `surfaceRaised` porque, en el oscuro, el borde `outline` sobre `surfaceRaised` daba 2,86:1 (<3:1); se separa del contenido con un filo decorativo y la sombra.

**No verificado en dispositivo:** el desenfoque, las animaciones, el cambio en vivo y el panel en pantallas pequeñas. `expo-blur` y `userInterfaceStyle` exigen un build nuevo de EAS; sin el módulo nativo el panel funciona con una capa oscura sin desenfoque.
