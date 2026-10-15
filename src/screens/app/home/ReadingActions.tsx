import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useReadingTimer } from '../../../context/ReadingTimerContext';
import { useNow } from '../../../hooks/useNow';
import { colors } from '../../../theme/colors';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { describeClock, formatClock, getElapsedMs, isTimerRunning } from '../../../utils/readingTimer';

interface ReadingActionsProps {
  onRegister: () => void;
  onOpenTimer: () => void;
}

const TICK_MS = 1000;
// Alto mínimo de cada card; `HomeSkeleton` usa la misma medida para que al cargar nada «salte».
const CARD_MIN_HEIGHT = minTouchSize * 2.5;

/**
 * Las dos formas de registrar lo leído en Inicio, cada una en su propia card: «Registrar lectura» (manual) y
 * «Cronómetro» (lectura medida). Son dos cards independientes, con su borde, fondo y acción; la fila solo las reparte
 * en dos mitades iguales y no dibuja nada. «Registrar lectura» es la principal (relleno verde) y «Cronómetro» la
 * alternativa (fondo claro). Se distinguen por relleno, icono y nombre, no solo por color.
 */
export function ReadingActions({ onRegister, onOpenTimer }: ReadingActionsProps) {
  return (
    <View style={styles.row}>
      <RegisterCard onPress={onRegister} />
      <TimerCard onPress={onOpenTimer} />
    </View>
  );
}

/** El círculo dorado (`accent`) con el icono: la marca de identidad que comparten las dos cards. */
function CardBadge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={iconSize.lg} color={colors.onAccent} accessible={false} />
    </View>
  );
}

function RegisterCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Registrar lectura"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.registerCard, pressed && styles.registerCardPressed]}
    >
      <CardBadge icon="add" />
      <Text style={[styles.label, { color: colors.onPrimary }]}>Registrar lectura</Text>
    </Pressable>
  );
}

/**
 * La card del cronómetro. Sin cronómetro es «Cronómetro»; con uno, muestra el tiempo (que sigue avanzando) y si está
 * leyendo o en pausa. Tiene su propio reloj para que solo esta card se repinte cada segundo.
 */
function TimerCard({ onPress }: { onPress: () => void }) {
  const { timer } = useReadingTimer();
  const running = timer ? isTimerRunning(timer) : false;
  const now = useNow(running ? TICK_MS : undefined);
  const elapsed = timer ? getElapsedMs(timer, now) : 0;

  const accessibilityLabel = timer
    ? `Cronómetro ${running ? 'en marcha' : 'en pausa'}: ${describeClock(elapsed)}`
    : 'Cronómetro';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.timerCard, timer && styles.timerCardActive, pressed && styles.timerCardPressed]}
    >
      <CardBadge icon={timer ? 'timer' : 'timer-outline'} />
      {timer ? (
        <View style={styles.status}>
          <Text style={[styles.label, styles.time, { color: colors.textPrimary }]}>{formatClock(elapsed)}</Text>
          <Text style={styles.caption}>{running ? 'Leyendo' : 'En pausa'}</Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: colors.textPrimary }]}>Cronómetro</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Solo reparte el ancho entre las dos cards: sin borde ni fondo, para que no parezcan un solo módulo.
  row: { flexDirection: 'row', gap: spacing.md },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: CARD_MIN_HEIGHT,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  registerCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  registerCardPressed: { backgroundColor: colors.pressed, borderColor: colors.pressed },
  // El borde `outline` es el límite del control: contraste ≥ 3:1 sobre el fondo.
  timerCard: { backgroundColor: colors.surface, borderColor: colors.outline },
  // Con un cronómetro en marcha o en pausa la card se enmarca en el color principal (además del tiempo y su estado en texto).
  timerCardActive: { borderColor: colors.primary },
  timerCardPressed: { opacity: opacity.pressed },
  badge: {
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: minTouchSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  // Cifras de ancho fijo: el reloj no «baila» al cambiar de segundo.
  time: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  status: { alignItems: 'center', gap: spacing.xs },
  caption: { fontSize: fontSize.sm, color: colors.textSecondary },
});
