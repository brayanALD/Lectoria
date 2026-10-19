# Lectoria

Aplicación móvil para seguir tus lecturas: organiza tu biblioteca, registra cuánto lees y mantén el hábito. El nombre une *lectura* y *trayectoria*.

> **Estado:** versión 1.2 (Fases 1 a 5 cerradas y, de la Fase 6, la lista de deseos, las notas y reseñas, el objetivo mensual, los autores, las sagas, las colecciones y las estanterías). Probada en Android; iOS pendiente. Siguiente, la versión 1.3 (ruleta de no leídos, logros y estantería realista).

## Fases de desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| 1. Preparar | Proyecto, autenticación (correo y Google), navegación, tema, reglas de Firestore | Cerrada (Android) |
| 2. Biblioteca | Libros: añadir, editar, eliminar, estados de lectura, búsqueda y filtros | Cerrada |
| 3. ISBN | Añadir libros por ISBN: escribiéndolo o escaneando el código de barras | Cerrada |
| 4. Sesiones | Registro de lecturas (manual y con cronómetro), progreso, calendario, rachas y meta diaria | Cerrada |
| 5. Estadísticas | Resúmenes de lectura por día y por mes, con la meta diaria integrada | Cerrada |
| 6. Experiencia lectora | Lista de deseos, notas y reseñas (versión 1.1); autores, sagas, colecciones y estanterías (versión 1.2); logros | En curso (1.2 cerrada) |
| 7. Pulir | Estantería visual, recordatorios, accesibilidad, rendimiento | Pendiente |

El plan completo (alcance, modelo de datos, decisiones y pendientes) está en [`BookTracker_Plan_de_desarrollo.md`](BookTracker_Plan_de_desarrollo.md).

## Qué se puede hacer hoy

- **Cuenta:** registrarse con correo (nombre y apodo opcional) o con Google, iniciar y cerrar sesión, mantener la sesión al reabrir y vincular ambos métodos de acceso desde «Mi espacio».
- **Biblioteca:** añadir libros a mano, ver la lista en tiempo real (en lista o cuadrícula), cambiar su estado de lectura (Quiero leerlo, Leyendo, En pausa, Terminado, Abandonado), editarlos y eliminarlos.
- **Añadir por ISBN:** escribir el ISBN (10 o 13 dígitos, con o sin guiones) o escanear el código de barras con la cámara; los datos del libro (título, autores, páginas y portada) se completan desde [Open Library](https://openlibrary.org) y se pueden corregir antes de guardar. Avisa si el libro ya está en tu biblioteca. El campo «Saga» sugiere las sagas que ya tienes registradas mientras escribes.
- **Búsqueda y filtros:** búsqueda de texto sin distinguir tildes ni mayúsculas, y filtros combinables por estado, género, autor y saga.
- **Registrar lecturas:** desde Inicio, desde el detalle de un libro o desde un día del Calendario, con la fecha de hoy o de cualquier día pasado, minutos, página y notas. En una lectura de otro día se indica también la página inicial. El progreso del libro se mantiene solo al crear, editar o eliminar una sesión.
- **Cronómetro:** iniciar, pausar, reanudar y finalizar una lectura. Mide con marcas de tiempo (sigue contando con la app en segundo plano), se recupera si la app se cierra y no duplica sesiones.
- **Calendario y rachas:** vistas semanal, mensual y anual con totales y detalle de cada día, y racha actual y récord en Inicio.
- **Meta diaria:** una meta de minutos o de páginas al día, a elegir, con barra de progreso en Inicio y cumplimiento de cada día en el Calendario. El progreso se calcula solo con las lecturas registradas, a mano o con el cronómetro.
- **Actividad reciente:** las últimas lecturas en Inicio y la lista de lecturas de cada libro, que se pueden editar y eliminar.
- **Estadísticas:** resumen por día y por mes (tiempo, páginas, sesiones, días de lectura y libros terminados), gráfico de lo leído cada día, cumplimiento de la meta diaria y racha. Se calculan siempre a partir de las lecturas registradas, así que coinciden con Inicio y el Calendario.
- **Lista de deseos y compras:** guardar los libros que quieres leer en la pestaña «Deseos» de Biblioteca (se añaden con el mismo formulario, también por ISBN o con el escáner) y, al comprarlos, pasarlos a tu biblioteca con «Marcar como comprado», indicando fecha y precio.
- **Notas y reseñas:** en cada libro tuyo, un espacio de notas para lo que quieras recordar mientras lees, y una reseña con calificación de media en media estrella, opinión general y hasta cinco reseñas de los temas que tú elijas (los personajes, el final…).
- **Terminar un libro:** al marcarlo como terminado se registra la lectura de las páginas que faltaban, sin que tengas que anotarla.
- **Objetivo mensual:** en Estadísticas, vista Mes, un objetivo de libros terminados al mes con su progreso.
- **Autores y sagas:** en «Mi espacio», la lista de autores y la de sagas de tu biblioteca. El detalle de un autor reúne sus libros; el de una saga los muestra en orden, con cuántos llevas terminados, el siguiente por leer y los números que faltan. También se abren tocando el autor o la saga en el detalle de un libro.
- **Colecciones:** listas de libros que eliges tú (propios o de tu lista de deseos), con buscador para añadirlos; se pueden renombrar, editar y eliminar sin tocar los libros.
- **Estanterías filtradas:** en Biblioteca, guarda la búsqueda y los filtros activos con un nombre; la estantería se actualiza sola cuando cambian tus libros.
- **Datos privados:** cada persona solo accede a su propia biblioteca (reglas de Firestore con validación de campos).

## Tecnología

Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation · Firebase (Authentication y Firestore) · AsyncStorage · expo-camera · Open Library (catálogo de libros, sin clave) · Jest.

## Primeros pasos

### Requisitos

- Node.js y npm.
- Un proyecto de Firebase con Authentication (correo/contraseña y, opcionalmente, Google) y Firestore.
- Java, solo para ejecutar las pruebas de reglas de Firestore con el emulador.

### Instalación

```bash
npm install
cp .env.example .env     # y completa los valores de tu proyecto de Firebase
```

Las variables (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` y, opcionalmente, `EXPO_PUBLIC_OPENLIBRARY_CONTACT`) se describen en `.env.example`. El archivo `.env` no se versiona.

### Ejecutar

```bash
npx expo start
```

El escáner de código de barras funciona también en Expo Go. El acceso con **Google** usa código nativo y **no funciona en Expo Go**: requiere una *development build* de EAS. Para generarla, coloca tu `google-services.json` en la raíz (no se versiona) y ejecuta `npx eas-cli build --profile development --platform android`. En EAS Build el archivo se entrega mediante la variable de entorno de tipo archivo `GOOGLE_SERVICES_JSON`. Después, `npx expo start` abre la app en esa build.

### Firebase

Reglas e índices de Firestore:

```bash
npx firebase-tools deploy --only firestore
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm test` | Pruebas unitarias (Jest) |
| `npm run test:rules` | Pruebas de las reglas y de los servicios (libros, sesiones, meta y sincronización) contra el emulador de Firestore |
| `npx expo-doctor` | Diagnóstico de dependencias |

## Estructura

```text
src/
├── components/   Interfaz reutilizable (tarjetas, formularios, skeletons, filtros)
├── context/      Estado global (sesión, datos de lectura y cronómetro)
├── hooks/        Acceso a datos desde las pantallas
├── navigation/   Pila de autenticación, pila de la app y pestañas
├── screens/      Pantallas (auth y app: home, library, calendar, statistics, profile)
├── services/     Único acceso a Firebase y al catálogo de libros
├── theme/        Tokens de diseño (colores, espaciado, tipografía)
├── types/        Modelos de TypeScript
└── utils/        Lógica pura y probada (validación, filtros, fechas, rachas, cronómetro, meta diaria)
tests/rules/      Pruebas contra el emulador de Firestore
firestore.rules   Reglas de seguridad
```

## Principios de diseño

La interfaz sigue cuatro principios que se verifican automáticamente donde es posible:

1. **Skeletons de carga:** siluetas del contenido en lugar de pantallas en blanco.
2. **Minimalismo (ley de Hick):** una acción principal por pantalla, sin texto superfluo.
3. **Design tokens estrictos:** colores y medidas solo desde `src/theme/`; una prueba falla si aparece un valor suelto.
4. **Accesibilidad:** contraste WCAG verificado por pruebas, zonas táctiles de 48 pt, roles y etiquetas accesibles, respeto a «reducir movimiento».

La paleta oficial es Evergreen `#14281D`, Hunter Green `#355834`, Olive Bark `#6E633D`, Soft Fawn `#C2A878` y Porcelain `#F1F5F2`.

## Seguridad

- Las reglas de Firestore aíslan los datos por usuario y validan tipos, límites y campos permitidos.
- Los archivos de configuración nativa de Firebase y las variables de entorno no están en el repositorio.
- Las claves de API de Firebase son identificadores de cliente; se restringen en Google Cloud a las aplicaciones y APIs necesarias.
