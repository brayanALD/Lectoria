import { getPathFromState, getStateFromPath } from '@react-navigation/native';

import { formatDocumentTitle, linkingConfig } from './linking';

// La configuración es la real; solo se ajusta el tipo, porque `parse` está tipado de forma más estricta que en uso.
const config = linkingConfig as unknown as Parameters<typeof getStateFromPath>[1];

interface StateLike {
  routes: { name: string; params?: object; state?: StateLike }[];
}

/** Los nombres de las pantallas de la rama activa (de fuera hacia dentro). */
function routeNames(path: string): string[] {
  const names: string[] = [];
  let current = getStateFromPath(path, config) as StateLike | undefined;
  while (current) {
    names.push(...current.routes.map((route) => route.name));
    current = current.routes[current.routes.length - 1].state;
  }
  return names;
}

describe('direcciones de la web', () => {
  it('la raíz es Inicio y cada pestaña tiene su dirección', () => {
    expect(routeNames('/')).toEqual(['Tabs', 'Home']);
    expect(routeNames('/biblioteca')).toContain('Library');
    expect(routeNames('/calendario')).toContain('Calendar');
    expect(routeNames('/estadisticas')).toContain('Statistics');
    expect(routeNames('/mi-espacio')).toContain('Profile');
  });

  it('una pantalla profunda deja las pestañas debajo, para poder volver', () => {
    const state = getStateFromPath('/libro/abc123', config) as StateLike;
    expect(state.routes.map((route) => route.name)).toEqual(['Tabs', 'BookDetail']);
    expect(state.routes[1].params).toEqual({ bookId: 'abc123' });
  });

  it('los nombres de sagas y autores con espacios y tildes viajan codificados', () => {
    const state = getStateFromPath('/autores/Gabriel%20Garc%C3%ADa%20M%C3%A1rquez', config) as StateLike;
    expect(state.routes[state.routes.length - 1]).toMatchObject({ name: 'AuthorDetail', params: { name: 'Gabriel García Márquez' } });

    const path = getPathFromState({ routes: [{ name: 'AuthorDetail', params: { name: 'Gabriel García Márquez' } }] }, config);
    expect(path).toBe('/autores/Gabriel%20Garc%C3%ADa%20M%C3%A1rquez');
  });

  it('la lectura del cronómetro conserva su indicador como booleano', () => {
    const state = getStateFromPath('/lectura?fromTimer=true', config) as StateLike;
    expect(state.routes[state.routes.length - 1]).toMatchObject({ name: 'AddSession', params: { fromTimer: true } });
  });

  it('el título de la pestaña del navegador lleva la marca', () => {
    expect(formatDocumentTitle({ title: 'Biblioteca' })).toBe('Biblioteca · Lectoria');
    expect(formatDocumentTitle({ title: '' })).toBe('Lectoria');
    expect(formatDocumentTitle(undefined)).toBe('Lectoria');
  });
});
