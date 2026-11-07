import { Image, StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import type { ColorTokens } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

const logo = require('../../assets/logo.png');
const LOGO_SIZE = spacing.xl * 2;
// Alto de la balda y del marcador dorado que cuelga de uno de los libros.
const SHELF_HEIGHT = spacing.sm;
const BAND = spacing.xs;
// Unidad de medida de los lomos: un paso y medio de la escala de espaciado.
const UNIT = spacing.xs * 1.5;

type SpineColor = 'brandSpineGreen' | 'brandSpineBark' | 'brandSpineFawn';

interface Spine {
  color: SpineColor;
  /** Ancho y alto del lomo, en unidades de `UNIT` para que todo salga de la misma escala. */
  width: number;
  height: number;
  /** El libro apoyado en el de al lado: se inclina sobre su esquina inferior. */
  leaning?: boolean;
}

// Una balda de lomos de distintas alturas y colores de la paleta: el motivo de la marca (una biblioteca) sin una sola
// palabra, en línea con «sin párrafos de ayuda».
const SHELF: Spine[] = [
  { color: 'brandSpineGreen', width: 8, height: 44 },
  { color: 'brandSpineFawn', width: 6, height: 52 },
  { color: 'brandSpineBark', width: 9, height: 40 },
  { color: 'brandSpineGreen', width: 7, height: 58 },
  { color: 'brandSpineBark', width: 6, height: 46 },
  { color: 'brandSpineFawn', width: 10, height: 38 },
  { color: 'brandSpineGreen', width: 8, height: 54, leaning: true },
  { color: 'brandSpineBark', width: 7, height: 50 },
  { color: 'brandSpineFawn', width: 6, height: 42 },
  { color: 'brandSpineGreen', width: 9, height: 56 },
  { color: 'brandSpineFawn', width: 7, height: 48 },
];

/**
 * El panel de marca de la pantalla de acceso en escritorio: el logo y el nombre arriba y, abajo, una balda con libros.
 * Es decorativo (no lo anuncian los lectores de pantalla) y tiene los mismos colores en los dos temas.
 */
export function BrandPanel() {
  const styles = useStyles();
  return (
    <View style={styles.panel} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.brand}>
        {/* El logo solo se ve bien sobre claro: va sobre una losa clara. */}
        <View style={styles.logoTile}>
          <Image source={logo} style={styles.logo} accessible={false} />
        </View>
        <Text style={styles.brandName}>Lectoria</Text>
      </View>

      <View style={styles.bookcase}>
        <View style={styles.books}>
          {SHELF.map((spine, index) => (
            <Book key={index} spine={spine} />
          ))}
        </View>
        <View style={styles.shelf} />
      </View>
    </View>
  );
}

function Book({ spine }: { spine: Spine }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.spine,
        {
          width: spine.width * UNIT,
          height: spine.height * UNIT,
        },
        // Cada lomo toma su color del tema (que en el panel es el mismo en claro y oscuro).
        spineColor(styles, spine.color),
        spine.leaning && styles.leaning,
      ]}
    >
      <View style={styles.band} />
      <View style={styles.band} />
    </View>
  );
}

function spineColor(styles: ReturnType<typeof useStyles>, color: SpineColor) {
  return styles[color];
}

const useStyles = makeStyles((colors: ColorTokens) =>
  StyleSheet.create({
    panel: {
      flex: 1,
      justifyContent: 'space-between',
      padding: spacing.xl * 2,
      backgroundColor: colors.brandPanel,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    logoTile: { padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSurface },
    logo: { width: LOGO_SIZE, height: LOGO_SIZE },
    brandName: { fontSize: fontSize.xl, fontFamily: fontFamily.displayBold, color: colors.onBrandPanel },
    // La balda mide lo que miden los libros; si el panel es más estrecho, se recorta por la derecha.
    bookcase: { alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden' },
    books: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
    spine: { borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2, justifyContent: 'space-between', paddingVertical: spacing.sm },
    brandSpineGreen: { backgroundColor: colors.brandSpineGreen },
    brandSpineBark: { backgroundColor: colors.brandSpineBark },
    brandSpineFawn: { backgroundColor: colors.brandSpineFawn },
    // Dos franjas oscuras por lomo, como las de un libro encuadernado.
    band: { height: BAND, backgroundColor: colors.brandPanel },
    leaning: { transform: [{ rotate: '-8deg' }], transformOrigin: 'bottom left' },
    shelf: { height: SHELF_HEIGHT, borderRadius: radius.pill, backgroundColor: colors.brandSpineBark },
  }),
);
