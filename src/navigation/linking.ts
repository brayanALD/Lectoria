import type { LinkingOptions } from '@react-navigation/native';
import { Platform } from 'react-native';

import type { AppStackParamList, AuthStackParamList, TabParamList } from './types';

type RootParamList = AppStackParamList & AuthStackParamList;

/**
 * Direcciones de la web: cada pantalla tiene su URL (se puede recargar, compartir y usar «atrás» del navegador). En el
 * móvil no se usan. Los nombres van en español y sin tildes para que la dirección sea limpia. Si se añade una pantalla
 * nueva al stack, hay que darle aquí su ruta.
 */
export const linkingConfig = {
  // Al abrir una dirección profunda (p. ej. /libro/abc) debajo queda Inicio, para que «volver» tenga a dónde ir.
  initialRouteName: 'Tabs' as const,
  screens: {
    Login: 'acceso',
    Register: 'registro',
    Tabs: {
      screens: {
        Home: '',
        Library: 'biblioteca',
        Calendar: 'calendario',
        Statistics: 'estadisticas',
        Profile: 'mi-espacio',
      } satisfies Record<keyof TabParamList, string>,
    },
    AddBook: 'biblioteca/nuevo',
    ScanBook: 'biblioteca/escanear',
    AddSession: {
      path: 'lectura',
      parse: { fromTimer: (value: string) => value === 'true' },
    },
    Timer: 'cronometro',
    BookDetail: 'libro/:bookId',
    EditBook: 'libro/:bookId/editar',
    BookNotes: 'libro/:bookId/notas',
    BookReview: 'libro/:bookId/resena',
    Collections: 'colecciones',
    CollectionDetail: 'colecciones/:collectionId',
    CollectionForm: 'coleccion/:collectionId?',
    Series: 'sagas',
    SeriesDetail: 'sagas/:name',
    Authors: 'autores',
    AuthorDetail: 'autores/:name',
  },
};

export const linking: LinkingOptions<RootParamList> = {
  // Solo en la web: en el móvil la navegación no tiene direcciones.
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: linkingConfig,
};

/** El título de la pestaña del navegador: el de la pantalla (si lo tiene) y la marca. */
export function formatDocumentTitle(options: { title?: string } | undefined): string {
  const title = options?.title?.trim();
  return title ? `${title} · Lectoria` : 'Lectoria';
}
