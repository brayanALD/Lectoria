import type { ReviewFields, SpecificReview } from '../types/book';
import { normalizeText } from './bookFilters';

// Límites alineados con firestore.rules (validBook → notes, review y specificReviews).
export const MAX_NOTES_LENGTH = 10000;
export const MAX_REVIEW_LENGTH = 10000;
export const MAX_SPECIFIC_REVIEW_LENGTH = 5000;
/** El tema de una reseña específica lo escribe la persona: una frase corta («Personajes», «El final»…). */
export const MAX_TOPIC_LENGTH = 60;
// El tope lo marca el límite de expresiones de las reglas de Firestore (ver firestore.rules): no subirlo sin medirlo.
export const MAX_SPECIFIC_REVIEWS = 5;

/** Las estrellas van de media en media: 0,5 · 1 · 1,5 … 5. Sin calificar es 0 en pantalla y no se guarda. */
export const MAX_RATING = 5;
export const RATING_STEP = 0.5;

/** ¿Es una calificación que se puede guardar? De 0,5 a 5, de media en media. */
export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && value >= RATING_STEP && value <= MAX_RATING && (value * 2) % 1 === 0;
}

/**
 * La calificación tras tocar la estrella `star` (1 a 5): la primera vez es la estrella entera; tocar otra vez la misma
 * la deja a la mitad, y una tercera vez la vuelve a completar. Así cada estrella es un solo botón de 48 pt, sin
 * depender de tocar con precisión la mitad izquierda.
 */
export function nextRating(current: number, star: number): number {
  return current === star ? star - RATING_STEP : star;
}

/** «4,5» (con coma, como en español) o «4». */
export function formatRating(rating: number): string {
  return String(rating).replace('.', ',');
}

/** Cómo se dice en voz alta: «4,5 estrellas de 5». */
export function describeRating(rating: number): string {
  return `${formatRating(rating)} ${rating === 1 ? 'estrella' : 'estrellas'} de ${MAX_RATING}`;
}

export type StarFill = 'full' | 'half' | 'empty';

/** Cómo se pinta cada una de las cinco estrellas para una calificación (0 = todas vacías). */
export function getStarFills(rating: number): StarFill[] {
  return Array.from({ length: MAX_RATING }, (_, index) => {
    if (rating >= index + 1) return 'full';
    if (rating >= index + 0.5) return 'half';
    return 'empty';
  });
}

export type NotesResult = { ok: true; notes?: string } | { ok: false; error: string };

/** Valida las notas: texto libre y opcional (vacío significa sin notas). Se conservan los saltos de línea. */
export function parseNotes(text: string): NotesResult {
  const notes = text.trim();
  if (notes.length > MAX_NOTES_LENGTH) return { ok: false, error: `Las notas no pueden superar ${MAX_NOTES_LENGTH} caracteres.` };
  return notes ? { ok: true, notes } : { ok: true };
}

/** Una reseña específica en el formulario: `id` identifica el bloque (el tema se puede estar escribiendo todavía). */
export interface SpecificReviewInput {
  id: string;
  topic: string;
  text: string;
}

/** Lo que escribe el formulario de la reseña: la calificación (0 = sin calificar), el texto general y los bloques añadidos. */
export interface ReviewFormValues {
  rating: number;
  review: string;
  specific: SpecificReviewInput[];
}

export const EMPTY_REVIEW_FORM: ReviewFormValues = { rating: 0, review: '', specific: [] };

export interface ReviewFormErrors {
  rating?: string;
  review?: string;
  /** Un error por bloque, por su `id`. */
  specific?: Record<string, { topic?: string; text?: string }>;
  /** Un error de toda la lista (p. ej. demasiadas reseñas). */
  specificList?: string;
}

export type ReviewFormResult = { ok: true; data: ReviewFields } | { ok: false; errors: ReviewFormErrors };

/** El tema tal como se guarda: sin espacios de más (varios seguidos cuentan como uno). */
function cleanTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ');
}

/**
 * Valida el formulario de la reseña y lo convierte en lo que se guarda. Todo es opcional, pero un bloque de reseña
 * específica necesita su tema y su texto (se completa o se quita, en lugar de perderse sin avisar) y no puede repetir el
 * tema de otro (sin distinguir tildes ni mayúsculas). No devuelve claves vacías: Firestore las rechazaría.
 */
export function parseReviewForm(values: ReviewFormValues): ReviewFormResult {
  const errors: ReviewFormErrors = {};

  const review = values.review.trim();
  if (review.length > MAX_REVIEW_LENGTH) errors.review = `La reseña no puede superar ${MAX_REVIEW_LENGTH} caracteres.`;

  const specific: SpecificReview[] = [];
  const specificErrors: Record<string, { topic?: string; text?: string }> = {};
  const seen = new Set<string>();
  for (const item of values.specific) {
    const topic = cleanTopic(item.topic);
    const text = item.text.trim();
    const key = normalizeText(topic);
    const itemErrors: { topic?: string; text?: string } = {};

    if (!topic) itemErrors.topic = 'Indica de qué trata esta reseña.';
    else if (topic.length > MAX_TOPIC_LENGTH) itemErrors.topic = `El tema no puede superar ${MAX_TOPIC_LENGTH} caracteres.`;
    else if (seen.has(key)) itemErrors.topic = 'Ya tienes una reseña con este tema.';
    if (topic) seen.add(key);

    if (!text) itemErrors.text = 'Escribe la reseña de este tema o quítala.';
    else if (text.length > MAX_SPECIFIC_REVIEW_LENGTH) {
      itemErrors.text = `No puede superar ${MAX_SPECIFIC_REVIEW_LENGTH} caracteres.`;
    }

    if (itemErrors.topic || itemErrors.text) specificErrors[item.id] = itemErrors;
    else specific.push({ topic, text });
  }
  if (Object.keys(specificErrors).length > 0) errors.specific = specificErrors;
  if (values.specific.length > MAX_SPECIFIC_REVIEWS) errors.specificList = `Máximo ${MAX_SPECIFIC_REVIEWS} reseñas específicas.`;

  if (values.rating !== 0 && !isValidRating(values.rating)) errors.rating = 'La calificación no es válida.';
  if (errors.rating || errors.review || errors.specific || errors.specificList) return { ok: false, errors };

  const data: ReviewFields = {};
  if (values.rating !== 0) data.rating = values.rating;
  if (review) data.review = review;
  if (specific.length > 0) data.specificReviews = specific;
  return { ok: true, data };
}

/** Los valores del formulario de la reseña a partir de lo guardado en el libro. */
export function reviewToFormValues(book: { rating?: number; review?: string; specificReviews?: SpecificReview[] }): ReviewFormValues {
  return {
    rating: isValidRating(book.rating) ? book.rating : 0,
    review: book.review ?? '',
    specific: (book.specificReviews ?? []).map((item, index) => ({ id: `saved-${index}`, topic: item.topic, text: item.text })),
  };
}

/** Los temas de las reseñas específicas del libro, en el orden en que se escribieron. */
export function getSpecificTopics(book: { specificReviews?: SpecificReview[] }): string[] {
  return (book.specificReviews ?? []).map((item) => item.topic);
}

/** ¿El libro tiene alguna parte de la reseña (calificación, texto general o alguna reseña específica)? */
export function hasReview(book: { rating?: number; review?: string; specificReviews?: SpecificReview[] }): boolean {
  return isValidRating(book.rating) || Boolean(book.review) || (book.specificReviews ?? []).length > 0;
}
