import { MAX_SERIES_SUGGESTIONS, getSeriesSuggestions } from './seriesSuggestions';

const sagas = ['Crónicas de Dune', 'Harry Potter', 'El Señor de los Anillos', 'Canción de hielo y fuego', 'Dune'];

describe('getSeriesSuggestions', () => {
  it('no sugiere nada con el campo vacío o solo con espacios', () => {
    expect(getSeriesSuggestions(sagas, '')).toEqual([]);
    expect(getSeriesSuggestions(sagas, '   ')).toEqual([]);
  });

  it('sugiere las sagas que empiezan por lo escrito, sin distinguir tildes ni mayúsculas', () => {
    expect(getSeriesSuggestions(sagas, 'cron')).toEqual(['Crónicas de Dune']);
    expect(getSeriesSuggestions(sagas, 'HARRY')).toEqual(['Harry Potter']);
    expect(getSeriesSuggestions(sagas, 'cancion')).toEqual(['Canción de hielo y fuego']);
  });

  it('también encuentra por una palabra intermedia o por cualquier parte del nombre', () => {
    expect(getSeriesSuggestions(sagas, 'anillos')).toEqual(['El Señor de los Anillos']); // palabra
    expect(getSeriesSuggestions(sagas, 'ñor')).toEqual(['El Señor de los Anillos']); // contiene
  });

  it('ordena primero las que empiezan por el texto, luego las de palabra y al final las que lo contienen', () => {
    const names = ['Las crónicas', 'Cronos', 'Macrocronología', 'Crónicas de Dune'];
    // «Cronos» y «Crónicas de Dune» empiezan por «cron»; «Las crónicas» tiene una palabra que empieza por él;
    // «Macrocronología» solo lo contiene.
    expect(getSeriesSuggestions(names, 'cron')).toEqual(['Crónicas de Dune', 'Cronos', 'Las crónicas', 'Macrocronología']);
  });

  it('con una letra ya ofrece opciones', () => {
    expect(getSeriesSuggestions(sagas, 'h')).toContain('Harry Potter');
  });

  it('no sugiere la saga escrita exactamente igual', () => {
    expect(getSeriesSuggestions(sagas, 'Dune')).toEqual(['Crónicas de Dune']);
    expect(getSeriesSuggestions(sagas, '  Dune  ')).toEqual(['Crónicas de Dune']);
  });

  it('sí sugiere la misma saga con distinta grafía, para adoptar el nombre ya registrado', () => {
    expect(getSeriesSuggestions(['Crónicas de Dune'], 'cronicas de dune')).toEqual(['Crónicas de Dune']);
    expect(getSeriesSuggestions(['Dune'], 'dune')).toEqual(['Dune']);
  });

  it('devuelve una lista vacía si nada coincide', () => {
    expect(getSeriesSuggestions(sagas, 'zzz')).toEqual([]);
    expect(getSeriesSuggestions([], 'dune')).toEqual([]);
  });

  it('elimina duplicados que solo difieren en tildes o mayúsculas', () => {
    expect(getSeriesSuggestions(['Crónicas', 'cronicas', 'CRÓNICAS'], 'cro')).toEqual(['Crónicas']);
  });

  it('ignora nombres vacíos y recorta espacios', () => {
    expect(getSeriesSuggestions(['', '   ', '  Harry Potter '], 'har')).toEqual(['Harry Potter']);
  });

  it('limita el número de sugerencias', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Saga ${String(i).padStart(2, '0')}`);
    expect(getSeriesSuggestions(many, 'saga')).toHaveLength(MAX_SERIES_SUGGESTIONS);
    expect(getSeriesSuggestions(many, 'saga', 3)).toEqual(['Saga 00', 'Saga 01', 'Saga 02']);
  });

  it('no modifica la lista original', () => {
    const input = ['B saga', 'A saga'];
    getSeriesSuggestions(input, 'saga');
    expect(input).toEqual(['B saga', 'A saga']);
  });
});
