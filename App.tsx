import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { ReadingDataProvider } from './src/context/ReadingDataContext';
import { ReadingTimerProvider } from './src/context/ReadingTimerContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
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
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
