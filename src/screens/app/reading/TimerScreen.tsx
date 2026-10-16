import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookPickerSheet } from '../../../components/BookPickerSheet';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { PickerRow } from '../../../components/PickerRow';
import { TimerSkeleton } from '../../../components/TimerSkeleton';
import { useReadingTimer } from '../../../context/ReadingTimerContext';
import { useOwnedBooks } from '../../../hooks/useOwnedBooks';
import { useNow } from '../../../hooks/useNow';
import type { AppStackParamList } from '../../../navigation/types';
import { makeStyles } from '../../../context/ThemeContext';
import { radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { describeClock, formatClock, getElapsedMs, isTimerRunning } from '../../../utils/readingTimer';
import { pickDefaultBook } from '../../../utils/sessionBooks';

type Props = NativeStackScreenProps<AppStackParamList, 'Timer'>;

const TICK_MS = 1000;
// Tamaño de las cifras del tiempo: es lo único que importa mirar en esta pantalla.
const CLOCK_SCALE = 2;

/**
 * Cronómetro de lectura: iniciar, pausar, reanudar y finalizar. El cronómetro vive en `ReadingTimerProvider`
 * (sigue al cambiar de pantalla y se recupera si la app se cierra); aquí solo se muestra y se controla.
 * «Finalizar» pausa el tiempo y abre «Registrar lectura» con los minutos y el libro ya puestos.
 */
export function TimerScreen({ navigation }: Props) {
  const styles = useStyles();
  const { books, loading: booksLoading, error, retry } = useOwnedBooks();
  const { timer, loading: timerLoading, start, pause, resume, discard } = useReadingTimer();
  const [chosenId, setChosenId] = useState<string | undefined>();
  const [bookSheet, setBookSheet] = useState(false);

  const running = timer ? isTimerRunning(timer) : false;
  // El reloj solo se repinta mientras corre; el tiempo se calcula siempre con las marcas guardadas.
  const now = useNow(running ? TICK_MS : undefined);

  // Con cronómetro, el libro es el suyo; sin él, el elegido o el que se está leyendo.
  const book = useMemo(() => {
    if (timer) return books.find((candidate) => candidate.id === timer.bookId);
    return (chosenId ? books.find((candidate) => candidate.id === chosenId) : undefined) ?? pickDefaultBook(books);
  }, [books, timer, chosenId]);

  if (booksLoading || timerLoading) return <TimerSkeleton />;

  if (error && books.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudieron cargar tus libros"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (timer && !book) {
    return (
      <EmptyState
        icon="book-outline"
        title="Este libro ya no existe"
        action={{ label: 'Descartar cronómetro', onPress: discard }}
      />
    );
  }

  if (!book) {
    return (
      <EmptyState
        icon="library-outline"
        title="Añade un libro para usar el cronómetro"
        action={{ label: 'Añadir libro', onPress: () => navigation.replace('AddBook') }}
      />
    );
  }

  const elapsed = timer ? getElapsedMs(timer, now) : 0;
  const paused = timer !== undefined && !running;

  const confirmDiscard = () => {
    Alert.alert('¿Descartar el cronómetro?', 'Se perderá el tiempo medido.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: discard },
    ]);
  };

  // Se pausa antes de abrir el formulario: si se sale sin guardar, el tiempo queda congelado, no sigue corriendo.
  const finish = () => {
    pause();
    navigation.replace('AddSession', { fromTimer: true });
  };

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PickerRow
          label="Libro"
          value={book.title}
          icon="chevron-down"
          onPress={timer ? undefined : () => setBookSheet(true)}
        />

        <View
          style={styles.clock}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={`Tiempo de lectura: ${describeClock(elapsed)}${paused ? ', en pausa' : ''}`}
        >
          <Text style={styles.time}>{formatClock(elapsed)}</Text>
          {paused ? <Text style={styles.state}>En pausa</Text> : null}
        </View>

        <View style={styles.actions}>
          {!timer ? (
            <Button title="Iniciar" onPress={() => start(book.id)} />
          ) : running ? (
            <Button title="Pausar" onPress={pause} />
          ) : (
            <Button title="Reanudar" onPress={resume} />
          )}
          {timer ? <Button title="Finalizar" variant="secondary" onPress={finish} /> : null}
          {timer ? <Button title="Descartar" variant="danger" onPress={confirmDiscard} /> : null}
        </View>
      </ScrollView>

      <BookPickerSheet
        visible={bookSheet}
        onClose={() => setBookSheet(false)}
        books={books}
        selectedId={book.id}
        onPick={(picked) => setChosenId(picked.id)}
      />
    </>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  clock: { alignItems: 'center', gap: spacing.xs, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  time: {
    fontSize: fontSize.xl * CLOCK_SCALE,
    fontFamily: fontFamily.displayBold,
    color: colors.primary,
    // Cifras de ancho fijo: el reloj no «baila» al cambiar de segundo.
    fontVariant: ['tabular-nums'],
  },
  state: { fontSize: fontSize.lg, fontFamily: fontFamily.regular, color: colors.textSecondary },
  actions: { gap: spacing.md },
}));
