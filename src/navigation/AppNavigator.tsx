import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StartupScreen } from '../components/StartupScreen';
import { useAuth } from '../context/AuthContext';
import { AddBookScreen } from '../screens/app/library/AddBookScreen';
import { BookDetailScreen } from '../screens/app/library/BookDetailScreen';
import { EditBookScreen } from '../screens/app/library/EditBookScreen';
import { ScanBookScreen } from '../screens/app/library/ScanBookScreen';
import { AddSessionScreen } from '../screens/app/reading/AddSessionScreen';
import { TimerScreen } from '../screens/app/reading/TimerScreen';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

// Navegación condicional por sesión: stack de la app si hay usuario, stack de autenticación si no.
export function AppNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return <StartupScreen />;
  if (!user) return <AuthNavigator />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {/* Pantallas secundarias: se abren encima de las pestañas, con encabezado y botón de volver. */}
      <Stack.Screen name="AddBook" component={AddBookScreen} options={{ headerShown: true, title: 'Añadir libro' }} />
      <Stack.Screen name="ScanBook" component={ScanBookScreen} options={{ headerShown: true, title: 'Escanear' }} />
      <Stack.Screen
        name="AddSession"
        component={AddSessionScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.sessionId ? 'Editar lectura' : 'Registrar lectura',
        })}
      />
      <Stack.Screen name="Timer" component={TimerScreen} options={{ headerShown: true, title: 'Cronómetro' }} />
      {/* Sin título: la propia pantalla ya muestra el nombre del libro. */}
      <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="EditBook" component={EditBookScreen} options={{ headerShown: true, title: 'Editar libro' }} />
    </Stack.Navigator>
  );
}
