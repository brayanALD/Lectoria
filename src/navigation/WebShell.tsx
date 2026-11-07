import type { NavigationHelpers, ParamListBase, StackNavigationState } from '@react-navigation/native';
import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Sidebar, type SidebarItem } from '../components/Sidebar';
import { useSettings } from '../context/SettingsContext';
import { makeStyles } from '../context/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { layout } from '../theme/spacing';
import { getActiveTab } from './activeTab';
import type { TabParamList } from './types';

const NAV_ITEMS: (SidebarItem & { key: keyof TabParamList })[] = [
  { key: 'Home', label: 'Inicio', icon: 'home-outline' },
  { key: 'Library', label: 'Biblioteca', icon: 'library-outline' },
  { key: 'Calendar', label: 'Calendario', icon: 'calendar-outline' },
  { key: 'Statistics', label: 'Estadísticas', icon: 'stats-chart-outline' },
  { key: 'Profile', label: 'Mi espacio', icon: 'person-outline' },
];

interface WebShellProps {
  children: ReactNode;
  state: StackNavigationState<ParamListBase>;
  navigation: NavigationHelpers<ParamListBase>;
}

/**
 * El marco de la web alrededor del stack de la app (se pasa como `layout` del navigator): en escritorio, la barra lateral
 * a la izquierda y el contenido en una columna centrada de ancho acotado; en una ventana estrecha (teléfono), nada
 * cambia y siguen las pestañas inferiores. En el móvil no hace nada. La barra lateral queda a la vista también mientras
 * se ve una pantalla secundaria (el detalle de un libro, un formulario…).
 */
export function WebShell({ children, state, navigation }: WebShellProps) {
  const styles = useStyles();
  const { isWide } = useLayout();
  const { open } = useSettings();
  const activeTab = useMemo(() => getActiveTab(state), [state]);

  if (Platform.OS !== 'web') return <>{children}</>;

  // La misma estructura en los dos anchos: al cambiar el tamaño de la ventana el navigator no se vuelve a montar.
  return (
    <View style={styles.root}>
      {isWide ? (
        <Sidebar
          items={NAV_ITEMS}
          activeKey={activeTab}
          // popTo vuelve a las pestañas ya abiertas (si hay una pantalla encima) en lugar de apilar otras nuevas.
          onSelect={(key) => navigation.dispatch({ type: 'POP_TO', payload: { name: 'Tabs', params: { screen: key } } })}
          onRegister={() => navigation.navigate('AddSession')}
          onOpenSettings={open}
        />
      ) : null}
      <View style={styles.main}>
        <View style={[styles.column, isWide && styles.columnWide]}>{children}</View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
    main: { flex: 1, alignItems: 'center', backgroundColor: colors.background },
    column: { flex: 1, width: '100%' },
    columnWide: { maxWidth: layout.contentMaxWidth },
  }),
);
