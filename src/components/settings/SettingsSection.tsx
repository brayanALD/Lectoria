import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** Un grupo de opciones del panel de configuración, con su título. Cada opción nueva vive en una sección. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    title: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  }),
);
