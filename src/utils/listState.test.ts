import { initialListState, listReducer, type ListState } from './listState';

describe('listReducer', () => {
  it('empieza cargando, sin elementos ni error', () => {
    expect(initialListState<string>()).toEqual({ items: [], loading: true, error: null });
  });

  it('success guarda los elementos y deja de cargar; una lista vacía también es un éxito', () => {
    expect(listReducer(initialListState<string>(), { type: 'success', items: ['a'] })).toEqual({
      items: ['a'],
      loading: false,
      error: null,
    });
    expect(listReducer(initialListState<string>(), { type: 'success', items: [] }).loading).toBe(false);
  });

  it('failure conserva los últimos elementos y guarda el mensaje', () => {
    const loaded: ListState<string> = { items: ['a'], loading: false, error: null };
    expect(listReducer(loaded, { type: 'failure', message: 'Sin conexión.' })).toEqual({
      items: ['a'],
      loading: false,
      error: 'Sin conexión.',
    });
  });

  it('subscribe vacía los elementos y limpia el error (no se muestran datos de otro usuario)', () => {
    const failed: ListState<string> = { items: ['de-otro-usuario'], loading: false, error: 'Error' };
    expect(listReducer(failed, { type: 'subscribe' })).toEqual({ items: [], loading: true, error: null });
  });

  it('idle (sin sesión) vacía todo y no queda cargando', () => {
    const loaded: ListState<string> = { items: ['a'], loading: false, error: null };
    expect(listReducer(loaded, { type: 'idle' })).toEqual({ items: [], loading: false, error: null });
  });

  it('success tras un error limpia el error', () => {
    const failed: ListState<string> = { items: [], loading: false, error: 'Sin conexión.' };
    expect(listReducer(failed, { type: 'success', items: ['a'] }).error).toBeNull();
  });
});
