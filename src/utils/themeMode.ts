export type ThemeMode = 'light' | 'dark';

/** Clave donde se guarda la elección de tema en el dispositivo (no depende del usuario: es una preferencia del aparato). */
export const THEME_STORAGE_KEY = 'lectoria.theme';

/** Lee el valor guardado; cualquier dato que no sea un tema válido se descarta. */
export function parseThemeMode(raw: string | null | undefined): ThemeMode | undefined {
  return raw === 'light' || raw === 'dark' ? raw : undefined;
}

/**
 * El tema con el que arranca la app: el que la persona eligió y quedó guardado o, si nunca eligió, el del sistema
 * (oscuro si el sistema está en oscuro; claro en cualquier otro caso).
 */
export function resolveThemeMode(stored: ThemeMode | undefined, system: string | null | undefined): ThemeMode {
  return stored ?? (system === 'dark' ? 'dark' : 'light');
}
