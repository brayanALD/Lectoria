import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';

import { fontFamily } from './typography';

/**
 * Archivos de las fuentes, indexados por el nombre de familia de `fontFamily`. Se importa cada peso por separado
 * (no desde la raíz del paquete) para empaquetar solo estos cinco archivos. `App.tsx` los carga con `useFonts`.
 */
export const fontFiles = {
  [fontFamily.regular]: Figtree_400Regular,
  [fontFamily.semibold]: Figtree_600SemiBold,
  [fontFamily.bold]: Figtree_700Bold,
  [fontFamily.display]: Literata_600SemiBold,
  [fontFamily.displayBold]: Literata_700Bold,
};
