import type { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import { NavRow } from './NavRow';

export interface NavRowItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

// Separación entre filas: la misma que entre tarjetas de libro.
const ROW_GAP = spacing.sm + spacing.xs;

/** Una lista de filas que abren su detalle: Colecciones, Sagas y Autores. */
export function NavRowList({ items, onOpen }: { items: readonly NavRowItem[]; onOpen: (id: string) => void }) {
  const styles = useStyles();
  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => (
        <NavRow title={item.title} subtitle={item.subtitle} icon={item.icon} onPress={() => onOpen(item.id)} />
      )}
    />
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  separator: { height: ROW_GAP },
}));
