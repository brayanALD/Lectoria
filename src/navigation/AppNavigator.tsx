import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { AddBookScreen } from '../screens/app/library/AddBookScreen';
import { BookDetailScreen } from '../screens/app/library/BookDetailScreen';
import { EditBookScreen } from '../screens/app/library/EditBookScreen';
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
      {/* Pantallas secundarias: se abren encima de las pestañas, con encabezado y botón de volver. */}
      <Stack.Screen name="AddBook" component={AddBookScreen} options={{ headerShown: true, title: 'Añadir libro' }} />
      <Stack.Screen
        name="BookDetail"
        component={BookDetailScreen}
        options={{ headerShown: true, title: 'Detalle del libro' }}
      />
      <Stack.Screen name="EditBook" component={EditBookScreen} options={{ headerShown: true, title: 'Editar libro' }} />
    </Stack.Navigator>
  );
}
