import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface SettingsValue {
  /** ¿Está desplegado el panel de configuración? */
  visible: boolean;
  open: () => void;
  close: () => void;
}

const SettingsContext = createContext<SettingsValue | undefined>(undefined);

/**
 * Estado del panel de configuración (abierto o cerrado), compartido por el botón de la tuerca de los encabezados y por
 * el propio panel, que se dibuja una sola vez en la raíz de la app. Las opciones de la configuración viven en sus
 * propias secciones (`components/settings`), no aquí.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ visible, open, close }), [visible, open, close]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return value;
}
