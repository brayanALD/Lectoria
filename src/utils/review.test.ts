import {
  EMPTY_REVIEW_FORM,
  MAX_NOTES_LENGTH,
  MAX_REVIEW_LENGTH,
  MAX_SPECIFIC_REVIEWS,
  MAX_SPECIFIC_REVIEW_LENGTH,
  MAX_TOPIC_LENGTH,
  describeRating,
  formatRating,
  getSpecificTopics,
  getStarFills,
  hasReview,
  isValidRating,
  nextRating,
  parseNotes,
  parseReviewForm,
  reviewToFormValues,
  type ReviewFormValues,
} from './review';

describe('isValidRating', () => {
  it.each([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('acepta %s', (value) => {
    expect(isValidRating(value)).toBe(true);
  });

  it.each([0, -1, 0.25, 4.3, 5.5, 6, NaN, Infinity, '4', null, undefined])('rechaza %s', (value) => {
    expect(isValidRating(value)).toBe(false);
  });
});

describe('nextRating', () => {
  it('tocar una estrella la rellena entera', () => {
    expect(nextRating(0, 3)).toBe(3);
    expect(nextRating(5, 2)).toBe(2);
    expect(nextRating(2.5, 4)).toBe(4);
  });

  it('tocar otra vez la misma la deja a la mitad, y otra vez la completa', () => {
    expect(nextRating(3, 3)).toBe(2.5);
    expect(nextRating(2.5, 3)).toBe(3);
  });

  it('la primera estrella puede quedar en media estrella', () => {
    expect(nextRating(1, 1)).toBe(0.5);
    expect(nextRating(0.5, 1)).toBe(1);
  });

  it('tocar la media estrella de otra estrella la rellena entera', () => {
    expect(nextRating(2.5, 5)).toBe(5);
    expect(nextRating(4.5, 4)).toBe(4);
  });

  it('siempre devuelve una calificación válida', () => {
    for (let current = 0; current <= 5; current += 0.5) {
      for (let star = 1; star <= 5; star++) expect(isValidRating(nextRating(current, star))).toBe(true);
    }
  });
});

describe('formatRating / describeRating', () => {
  it('usa la coma del español', () => {
    expect(formatRating(4.5)).toBe('4,5');
    expect(formatRating(4)).toBe('4');
    expect(formatRating(0.5)).toBe('0,5');
  });

  it('lo dice en voz alta, con singular solo para una estrella', () => {
    expect(describeRating(4.5)).toBe('4,5 estrellas de 5');
    expect(describeRating(1)).toBe('1 estrella de 5');
    expect(describeRating(5)).toBe('5 estrellas de 5');
  });
});

describe('getStarFills', () => {
  it('sin calificar, todas vacías', () => {
    expect(getStarFills(0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });

  it('pinta las enteras, la media y las vacías', () => {
    expect(getStarFills(3.5)).toEqual(['full', 'full', 'full', 'half', 'empty']);
    expect(getStarFills(0.5)).toEqual(['half', 'empty', 'empty', 'empty', 'empty']);
    expect(getStarFills(5)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(getStarFills(4.5)).toEqual(['full', 'full', 'full', 'full', 'half']);
  });
});

describe('parseNotes', () => {
  it('vacío o solo espacios significa sin notas', () => {
    expect(parseNotes('')).toEqual({ ok: true });
    expect(parseNotes('  \n  ')).toEqual({ ok: true });
  });

  it('recorta los extremos y conserva los saltos de línea y los espacios internos', () => {
    expect(parseNotes('  idea 1\n\nidea  2  ')).toEqual({ ok: true, notes: 'idea 1\n\nidea  2' });
  });

  it('acepta el máximo y rechaza pasarse', () => {
    expect(parseNotes('a'.repeat(MAX_NOTES_LENGTH))).toMatchObject({ ok: true });
    expect(parseNotes('a'.repeat(MAX_NOTES_LENGTH + 1))).toMatchObject({ ok: false });
  });
});

const block = (id: string, topic: string, text: string) => ({ id, topic, text });
const form = (overrides: Partial<ReviewFormValues> = {}): ReviewFormValues => ({ ...EMPTY_REVIEW_FORM, ...overrides });

describe('parseReviewForm', () => {
  it('una reseña vacía es válida y no guarda nada', () => {
    expect(parseReviewForm(EMPTY_REVIEW_FORM)).toEqual({ ok: true, data: {} });
  });

  it('solo la calificación, con media estrella', () => {
    expect(parseReviewForm(form({ rating: 4.5 }))).toEqual({ ok: true, data: { rating: 4.5 } });
  });

  it('el 0 significa sin calificar: no se guarda', () => {
    const result = parseReviewForm(form({ rating: 0, review: 'Me gustó' }));
    expect(result).toEqual({ ok: true, data: { review: 'Me gustó' } });
    expect(result.ok && 'rating' in result.data).toBe(false);
  });

  it('el tema lo escribe la persona: cualquier texto sirve, en el orden en que lo puso', () => {
    const result = parseReviewForm(
      form({
        rating: 5,
        review: '  Imprescindible  ',
        specific: [block('a', ' El final ', ' Redondo '), block('b', 'Personajes', 'Muy vivos'), block('c', 'La música del libro', 'Casi se oye')],
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        rating: 5,
        review: 'Imprescindible',
        specificReviews: [
          { topic: 'El final', text: 'Redondo' },
          { topic: 'Personajes', text: 'Muy vivos' },
          { topic: 'La música del libro', text: 'Casi se oye' },
        ],
      },
    });
  });

  it('colapsa los espacios repetidos del tema', () => {
    const result = parseReviewForm(form({ specific: [block('a', '  Construcción   del  mundo ', 'Rica')] }));
    expect(result).toMatchObject({ ok: true, data: { specificReviews: [{ topic: 'Construcción del mundo', text: 'Rica' }] } });
  });

  it('no incluye claves vacías ni undefined (Firestore las rechaza)', () => {
    const result = parseReviewForm(form({ rating: 3, review: '   ' }));
    if (!result.ok) throw new Error('se esperaba un resultado válido');
    expect(Object.keys(result.data)).toEqual(['rating']);
  });

  it('un bloque sin tema o sin texto es un error en ese bloque, no se pierde en silencio', () => {
    const result = parseReviewForm(form({ specific: [block('a', '', 'Algo'), block('b', 'Trama', '   '), block('c', 'Ritmo', 'Ágil')] }));
    expect(result).toEqual({
      ok: false,
      errors: {
        specific: {
          a: { topic: 'Indica de qué trata esta reseña.' },
          b: { text: 'Escribe la reseña de este tema o quítala.' },
        },
      },
    });
  });

  it('un bloque en blanco avisa de las dos cosas', () => {
    const result = parseReviewForm(form({ specific: [block('a', '', '')] }));
    expect(result).toMatchObject({ ok: false, errors: { specific: { a: { topic: expect.any(String), text: expect.any(String) } } } });
  });

  it('no admite el mismo tema dos veces, sin distinguir tildes, mayúsculas ni espacios', () => {
    const result = parseReviewForm(form({ specific: [block('a', 'Construcción del mundo', 'Rica'), block('b', ' construccion  DEL mundo', 'Otra')] }));
    expect(result).toEqual({ ok: false, errors: { specific: { b: { topic: 'Ya tienes una reseña con este tema.' } } } });
  });

  it('el tema repetido se avisa aunque el primero tenga otro error', () => {
    const result = parseReviewForm(form({ specific: [block('a', 'Trama', ''), block('b', 'trama', 'Ágil')] }));
    expect(result).toMatchObject({ ok: false, errors: { specific: { a: { text: expect.any(String) }, b: { topic: 'Ya tienes una reseña con este tema.' } } } });
  });

  it('respeta los límites de cada texto y del tema', () => {
    expect(parseReviewForm(form({ review: 'a'.repeat(MAX_REVIEW_LENGTH) })).ok).toBe(true);
    expect(parseReviewForm(form({ review: 'a'.repeat(MAX_REVIEW_LENGTH + 1) })).ok).toBe(false);
    expect(parseReviewForm(form({ specific: [block('a', 'a'.repeat(MAX_TOPIC_LENGTH), 'x'.repeat(MAX_SPECIFIC_REVIEW_LENGTH))] })).ok).toBe(true);
    expect(parseReviewForm(form({ specific: [block('a', 'a'.repeat(MAX_TOPIC_LENGTH + 1), 'x')] })).ok).toBe(false);
    expect(parseReviewForm(form({ specific: [block('a', 'Trama', 'x'.repeat(MAX_SPECIFIC_REVIEW_LENGTH + 1))] })).ok).toBe(false);
  });

  it('admite hasta el máximo de reseñas específicas y no más', () => {
    const many = (count: number) => Array.from({ length: count }, (_, i) => block(`b${i}`, `Tema ${i}`, `Texto ${i}`));
    expect(parseReviewForm(form({ specific: many(MAX_SPECIFIC_REVIEWS) })).ok).toBe(true);
    expect(parseReviewForm(form({ specific: many(MAX_SPECIFIC_REVIEWS + 1) }))).toMatchObject({
      ok: false,
      errors: { specificList: expect.any(String) },
    });
  });

  it('rechaza una calificación que no es de media en media', () => {
    expect(parseReviewForm(form({ rating: 4.3 }))).toMatchObject({ ok: false, errors: { rating: expect.any(String) } });
    expect(parseReviewForm(form({ rating: 6 })).ok).toBe(false);
  });

  it('informa de todos los errores a la vez', () => {
    const result = parseReviewForm(form({ review: 'a'.repeat(MAX_REVIEW_LENGTH + 1), specific: [block('a', '', '')] }));
    expect(result).toMatchObject({ ok: false, errors: { review: expect.any(String), specific: { a: expect.any(Object) } } });
  });
});

describe('reviewToFormValues / getSpecificTopics / hasReview', () => {
  const saved = {
    rating: 4.5,
    review: 'Muy bueno',
    specificReviews: [
      { topic: 'Ritmo', text: 'Ágil' },
      { topic: 'El mundo', text: 'Rico' },
    ],
  };

  it('los valores del formulario salen de lo guardado, y un libro sin reseña da el formulario vacío', () => {
    expect(reviewToFormValues(saved)).toEqual({
      rating: 4.5,
      review: 'Muy bueno',
      specific: [
        { id: 'saved-0', topic: 'Ritmo', text: 'Ágil' },
        { id: 'saved-1', topic: 'El mundo', text: 'Rico' },
      ],
    });
    expect(reviewToFormValues({})).toEqual(EMPTY_REVIEW_FORM);
  });

  it('ida y vuelta: lo guardado se puede volver a guardar igual', () => {
    expect(parseReviewForm(reviewToFormValues(saved))).toEqual({ ok: true, data: saved });
  });

  it('una calificación guardada no válida se ignora al editar', () => {
    expect(reviewToFormValues({ rating: 4.3 }).rating).toBe(0);
  });

  it('los temas guardados salen en el orden en que se escribieron', () => {
    expect(getSpecificTopics(saved)).toEqual(['Ritmo', 'El mundo']);
    expect(getSpecificTopics({})).toEqual([]);
  });

  it('hay reseña con cualquiera de sus partes', () => {
    expect(hasReview({})).toBe(false);
    expect(hasReview({ rating: 3 })).toBe(true);
    expect(hasReview({ review: 'Algo' })).toBe(true);
    expect(hasReview({ specificReviews: [{ topic: 'Trama', text: 'Algo' }] })).toBe(true);
    expect(hasReview({ review: '', specificReviews: [] })).toBe(false);
  });
});
