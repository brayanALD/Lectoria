import { MAX_SESSION_MINUTES, toDateKey } from './session';

/**
 * Cronómetro de lectura. Mide con marcas de tiempo (milisegundos desde 1970), nunca con un contador que avanza solo:
 * si la app pasa a segundo plano, el teléfono se bloquea o el sistema cierra la app, el tiempo transcurrido sigue
 * siendo `acumulado + (ahora − inicio del tramo en marcha)`.
 */
export interface ReadingTimer {
  bookId: string;
  /** Cuándo se pulsó «Iniciar». Identifica al cronómetro (y a la sesión que genera). */
  startedAt: number;
  /** Tiempo de los tramos ya cerrados (lo leído antes de cada pausa). */
  accumulatedMs: number;
  /** Cuándo empezó el tramo actual. Ausente si el cronómetro está en pausa. */
  runningSince?: number;
}

export function startTimer(bookId: string, now: number): ReadingTimer {
  return { bookId, startedAt: now, accumulatedMs: 0, runningSince: now };
}

export function isTimerRunning(timer: ReadingTimer): boolean {
  return timer.runningSince !== undefined;
}

/** Tiempo transcurrido. Nunca es negativo, aunque el reloj del teléfono se haya retrasado. */
export function getElapsedMs(timer: ReadingTimer, now: number): number {
  const segment = timer.runningSince === undefined ? 0 : Math.max(0, now - timer.runningSince);
  return timer.accumulatedMs + segment;
}

/** Pausar cierra el tramo en marcha. Si ya estaba en pausa no cambia nada. */
export function pauseTimer(timer: ReadingTimer, now: number): ReadingTimer {
  if (!isTimerRunning(timer)) return timer;
  return { bookId: timer.bookId, startedAt: timer.startedAt, accumulatedMs: getElapsedMs(timer, now) };
}

/** Reanudar abre un tramo nuevo. Si ya estaba en marcha no cambia nada (no se cuenta dos veces). */
export function resumeTimer(timer: ReadingTimer, now: number): ReadingTimer {
  if (isTimerRunning(timer)) return timer;
  return { ...timer, runningSince: now };
}

/** Minutos de la sesión: el tiempo redondeado al minuto más cercano, con el tope de una sesión (24 h). */
export function elapsedToMinutes(ms: number): number {
  return Math.min(MAX_SESSION_MINUTES, Math.max(0, Math.round(ms / 60_000)));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** «05:09» o, pasada la hora, «1:05:09». */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** El mismo tiempo dicho en palabras, para el lector de pantalla: «1 hora, 5 minutos y 9 segundos». */
export function describeClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const unit = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;
  const parts = [
    totalSeconds >= 3600 ? unit(Math.floor(totalSeconds / 3600), 'hora', 'horas') : null,
    totalSeconds >= 60 ? unit(Math.floor((totalSeconds % 3600) / 60), 'minuto', 'minutos') : null,
    unit(totalSeconds % 60, 'segundo', 'segundos'),
  ].filter((part): part is string => part !== null);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/**
 * Id de la sesión que genera este cronómetro. Es siempre el mismo para el mismo cronómetro: si por un fallo se
 * intentara guardar dos veces, Firestore rechazaría la segunda en lugar de crear una sesión duplicada.
 */
export function timerSessionId(timer: ReadingTimer): string {
  return `timer-${timer.startedAt}`;
}

/** Lo que el formulario «Registrar lectura» precarga al finalizar el cronómetro. */
export interface TimerDraft {
  bookId: string;
  /** Minutos como texto de formulario; vacío si el cronómetro no llegó a medio minuto. */
  minutes: string;
  /** Día en que se empezó a leer (zona horaria del dispositivo). */
  dayKey: string;
  sessionId: string;
}

export function buildTimerDraft(timer: ReadingTimer, now: number): TimerDraft {
  const minutes = elapsedToMinutes(getElapsedMs(timer, now));
  return {
    bookId: timer.bookId,
    minutes: minutes > 0 ? String(minutes) : '',
    dayKey: toDateKey(new Date(timer.startedAt)),
    sessionId: timerSessionId(timer),
  };
}

export function serializeTimer(timer: ReadingTimer): string {
  return JSON.stringify(timer);
}

/** Lee un cronómetro guardado. Cualquier dato dañado o incompleto se descarta (devuelve `undefined`). */
export function parseStoredTimer(raw: string | null): ReadingTimer | undefined {
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;

  const { bookId, startedAt, accumulatedMs, runningSince } = value as Record<string, unknown>;
  const isTime = (candidate: unknown): candidate is number => typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0;

  if (typeof bookId !== 'string' || bookId.length === 0 || !isTime(startedAt) || !isTime(accumulatedMs)) return undefined;
  if (runningSince === undefined) return { bookId, startedAt, accumulatedMs };
  return isTime(runningSince) ? { bookId, startedAt, accumulatedMs, runningSince } : undefined;
}
