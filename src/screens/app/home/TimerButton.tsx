import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../../../components/Button';
import { useReadingTimer } from '../../../context/ReadingTimerContext';
import { useNow } from '../../../hooks/useNow';
import type { AppStackParamList } from '../../../navigation/types';
import { formatClock, getElapsedMs, isTimerRunning } from '../../../utils/readingTimer';

const TICK_MS = 1000;

/**
 * Entrada al cronómetro desde Inicio. Sin cronómetro es «Cronómetro»; con uno, vuelve a él mostrando el tiempo
 * (que sigue avanzando) y si está en pausa. Tiene su propio reloj para que solo este botón se repinte cada segundo.
 */
export function TimerButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { timer } = useReadingTimer();
  const running = timer ? isTimerRunning(timer) : false;
  const now = useNow(running ? TICK_MS : undefined);

  const title = !timer
    ? 'Cronómetro'
    : `${running ? 'Leyendo' : 'En pausa'} · ${formatClock(getElapsedMs(timer, now))}`;

  return <Button title={title} variant="secondary" onPress={() => navigation.navigate('Timer')} />;
}
