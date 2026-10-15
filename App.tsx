import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StartupScreen } from './src/components/StartupScreen';
import { AuthProvider } from './src/context/AuthContext';
import { ReadingDataProvider } from './src/context/ReadingDataContext';
import { ReadingTimerProvider } from './src/context/ReadingTimerContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors, isDark } from './src/theme/colors';
import { fontFiles } from './src/theme/fonts';

const baseTheme = isDark ? DarkTheme : DefaultTheme;
const navigationTheme: Theme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};

// Providers en la raíz: AuthProvider > ReadingDataProvider > ReadingTimerProvider > NavigationContainer > navigator.
export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);

  // Mientras se cargan las fuentes se muestra el mismo logo que la pantalla de inicio nativa. Si fallan, la app sigue
  // con la fuente del sistema en lugar de quedarse bloqueada.
  if (!fontsLoaded && !fontError) return <StartupScreen />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ReadingDataProvider>
          <ReadingTimerProvider>
            <NavigationContainer theme={navigationTheme}>
              <AppNavigator />
            </NavigationContainer>
          </ReadingTimerProvider>
        </ReadingDataProvider>
      </AuthProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
