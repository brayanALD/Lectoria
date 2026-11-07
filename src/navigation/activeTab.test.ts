import { getActiveTab } from './activeTab';

describe('getActiveTab', () => {
  it('con las pestañas arriba, la pestaña activa de su estado', () => {
    const state = {
      index: 0,
      routes: [
        {
          name: 'Tabs',
          state: {
            index: 3,
            routes: [{ name: 'Home' }, { name: 'Library' }, { name: 'Calendar' }, { name: 'Statistics' }, { name: 'Profile' }],
          },
        },
      ],
    };
    expect(getActiveTab(state)).toBe('Statistics');
  });

  it('antes de montar las pestañas usa el parámetro `screen` o Inicio', () => {
    expect(getActiveTab({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Calendar' } }] })).toBe('Calendar');
    expect(getActiveTab({ index: 0, routes: [{ name: 'Tabs' }] })).toBe('Home');
  });

  it('una pantalla secundaria abierta encima marca la pestaña a la que pertenece', () => {
    const tabs = { name: 'Tabs', state: { index: 0, routes: [{ name: 'Home' }, { name: 'Library' }] } };
    expect(getActiveTab({ index: 1, routes: [tabs, { name: 'BookDetail' }] })).toBe('Library');
    expect(getActiveTab({ index: 1, routes: [tabs, { name: 'AddSession' }] })).toBe('Home');
    expect(getActiveTab({ index: 1, routes: [tabs, { name: 'Authors' }] })).toBe('Profile');
  });

  it('sin rutas no marca ninguna', () => {
    expect(getActiveTab({ index: 0, routes: [] })).toBeUndefined();
  });
});
