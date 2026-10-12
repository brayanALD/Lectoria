import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

// Navegación condicional por sesión: stack de la app si hay usuario, stack de autenticación si no.
export function AppNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return <LoadingSpinner />;
  if (!user) return <AuthNavigator />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}
