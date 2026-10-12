# src

Responsabilidades (detalle en `../BookTracker_Plan_de_desarrollo.md`, sección 11):

- `components/`: UI reutilizable; pinta, no accede a datos.
- `context/`: estado global (`AuthContext`).
- `navigation/`: `AppNavigator` (auth vs. app), `AuthNavigator`, `TabNavigator`.
- `screens/auth/`, `screens/app/{home,library,reading,calendar,statistics,profile}/`: orquestan la interacción.
- `services/`: única capa que accede a Firebase y al proveedor de libros.
- `hooks/`: acceso a datos desde las pantallas.
- `types/`: modelos TypeScript.
- `theme/`: tokens (colores, tipografía, espaciado); sin colores sueltos en componentes.
- `utils/`: funciones puras y testeables (fechas, ISBN, rachas, estadísticas).

Las carpetas están vacías hasta la Fase 1; crear archivos solo al implementar cada función.
