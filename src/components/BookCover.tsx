import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';
import { getCoverColors, getCoverInitials } from '../utils/bookCover';

// Proporción habitual de una portada (ancho : alto = 2 : 3).
const ASPECT_RATIO = 2 / 3;
// Tamaño de las iniciales respecto al ancho de la portada.
const INITIALS_SCALE = 0.32;

interface BookCoverProps {
  title: string;
  coverUrl?: string;
  /** Ancho en puntos. Sin él, la portada ocupa todo el ancho de su contenedor. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Portada del libro. Si no hay imagen, o no se puede cargar, muestra un reemplazo con las iniciales del
 * título sobre un color de la paleta (siempre el mismo para el mismo título).
 */
export function BookCover({ title, coverUrl, width, style }: BookCoverProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(coverUrl) && failedUrl !== coverUrl;
  const colors = getCoverColors(title);
  const size = width ? { width, height: width / ASPECT_RATIO } : { width: '100%' as const, aspectRatio: ASPECT_RATIO };

  return (
    // Decorativa: el nombre del libro ya lo anuncia el elemento que la contiene.
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, size, { backgroundColor: colors.background }, style]}
    >
      {showImage ? (
        <Image
          source={{ uri: coverUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailedUrl(coverUrl ?? null)}
        />
      ) : (
        <Text
          style={[styles.initials, { color: colors.foreground, fontSize: width ? width * INITIALS_SCALE : fontSize.xl }]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {getCoverInitials(title)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  initials: { fontWeight: fontWeight.bold },
});
