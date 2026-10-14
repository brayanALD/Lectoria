import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { HomeSkeleton } from '../../../components/HomeSkeleton';
import { useBooks } from '../../../hooks/useBooks';
import { useSessions } from '../../../hooks/useSessions';
import type { AppStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { computeStreaks, getReadingDays } from '../../../utils/readingDays';
import { toDateKey } from '../../../utils/session';

// Tamaño de la cifra de la racha: lo más grande de la app, es lo primero que debe leerse en Inicio.
const STREAK_NUMBER_SCALE = 2;

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const books = useBooks();
  const sessions = useSessions();

  const todayKey = toDateKey(new Date());
  const streaks = useMemo(
    () => computeStreaks(getReadingDays(sessions.sessions), todayKey),
    [sessions.sessions, todayKey],
  );

  if (books.loading || sessions.loading) return <HomeSkeleton />;

  const error = books.error ?? sessions.error;
  if (error && books.books.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar tu información"
        description={error}
        action={{
          label: 'Reintentar',
          onPress: () => {
            books.retry();
            sessions.retry();
          },
        }}
      />
    );
  }

  if (books.books.length === 0) {
    return (
      <EmptyState
        icon="library-outline"
        title="Añade tu primer libro"
        action={{ label: 'Añadir libro', onPress: () => navigation.navigate('AddBook') }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.streak} accessible accessibilityLabel={describeStreak(streaks.current, streaks.longest)}>
        <Text style={styles.number}>{streaks.current}</Text>
        <Text style={styles.caption}>{streaks.current === 1 ? 'día seguido' : 'días seguidos'}</Text>
        {streaks.longest > streaks.current ? <Text style={styles.record}>Récord: {streaks.longest}</Text> : null}
      </View>
      <Button title="Registrar lectura" onPress={() => navigation.navigate('AddSession')} />
    </View>
  );
}

/** Frase completa para el lector de pantalla (la cifra y su leyenda se leen como una sola cosa). */
function describeStreak(current: number, longest: number): string {
  const days = (count: number) => `${count} ${count === 1 ? 'día seguido' : 'días seguidos'}`;
  return longest > current ? `Racha de ${days(current)}. Récord: ${longest}.` : `Racha de ${days(current)}.`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl, backgroundColor: colors.background },
  streak: { alignItems: 'center', gap: spacing.xs },
  number: { fontSize: fontSize.xl * STREAK_NUMBER_SCALE, fontWeight: fontWeight.bold, color: colors.primary },
  caption: { fontSize: fontSize.lg, color: colors.textPrimary },
  record: { fontSize: fontSize.sm, color: colors.textSecondary },
});
