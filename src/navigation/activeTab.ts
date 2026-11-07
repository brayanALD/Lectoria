import type { AppStackParamList, TabParamList } from './types';

/** La pestaña a la que «pertenece» cada pantalla del stack (la que se marca en la barra lateral mientras se ve). */
const TAB_OF_SCREEN: Partial<Record<keyof AppStackParamList, keyof TabParamList>> = {
  AddSession: 'Home',
  Timer: 'Home',
  AddBook: 'Library',
  ScanBook: 'Library',
  BookDetail: 'Library',
  EditBook: 'Library',
  BookNotes: 'Library',
  BookReview: 'Library',
  Collections: 'Profile',
  CollectionDetail: 'Profile',
  CollectionForm: 'Profile',
  Series: 'Profile',
  SeriesDetail: 'Profile',
  Authors: 'Profile',
  AuthorDetail: 'Profile',
};

interface RouteLike {
  name: string;
  params?: object;
  state?: { index?: number; routes: { name: string }[] };
}

/**
 * La pestaña que está a la vista: la activa si arriba del todo está `Tabs`, o la de la pantalla secundaria abierta encima
 * (p. ej. el detalle de un libro cuenta como «Biblioteca»). `state` es el estado del stack principal.
 */
export function getActiveTab(state: { index: number; routes: RouteLike[] }): keyof TabParamList | undefined {
  const route = state.routes[state.index];
  if (!route) return undefined;
  if (route.name !== 'Tabs') return TAB_OF_SCREEN[route.name as keyof AppStackParamList];

  // Con las pestañas ya montadas, su estado dice cuál está activa; antes (arranque con una dirección) lo dice el parámetro.
  const nested = route.state;
  if (nested?.routes.length) return nested.routes[nested.index ?? 0]?.name as keyof TabParamList;
  const screen = (route.params as { screen?: keyof TabParamList } | undefined)?.screen;
  return screen ?? 'Home';
}
