import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StartupScreen } from '../components/StartupScreen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CollectionDetailScreen } from '../screens/app/collections/CollectionDetailScreen';
import { CollectionFormScreen } from '../screens/app/collections/CollectionFormScreen';
import { CollectionsScreen } from '../screens/app/collections/CollectionsScreen';
import { AddBookScreen } from '../screens/app/library/AddBookScreen';
import { AuthorDetailScreen } from '../screens/app/library/AuthorDetailScreen';
import { AuthorsScreen } from '../screens/app/library/AuthorsScreen';
import { BookDetailScreen } from '../screens/app/library/BookDetailScreen';
import { BookNotesScreen } from '../screens/app/library/BookNotesScreen';
import { BookReviewScreen } from '../screens/app/library/BookReviewScreen';
import { EditBookScreen } from '../screens/app/library/EditBookScreen';
import { ScanBookScreen } from '../screens/app/library/ScanBookScreen';
import { SeriesDetailScreen } from '../screens/app/library/SeriesDetailScreen';
import { SeriesListScreen } from '../screens/app/library/SeriesListScreen';
import { AddSessionScreen } from '../screens/app/reading/AddSessionScreen';
import { TimerScreen } from '../screens/app/reading/TimerScreen';
import { AuthNavigator } from './AuthNavigator';
import { getHeaderOptions } from './chrome';
import { TabNavigator } from './TabNavigator';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

// Navegación condicional por sesión: stack de la app si hay usuario, stack de autenticación si no.
export function AppNavigator() {
  const { user, initializing } = useAuth();
  const { colors } = useTheme();

  if (initializing) return <StartupScreen />;
  if (!user) return <AuthNavigator />;

  return (
    <Stack.Navigator screenOptions={{ ...getHeaderOptions(colors), headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {/* Pantallas secundarias: se abren encima de las pestañas, con encabezado y botón de volver. */}
      <Stack.Screen
        name="AddBook"
        component={AddBookScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.acquisition === 'wishlist' ? 'Añadir a deseos' : 'Añadir libro',
        })}
      />
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
      <Stack.Screen name="BookNotes" component={BookNotesScreen} options={{ headerShown: true, title: 'Notas' }} />
      <Stack.Screen name="BookReview" component={BookReviewScreen} options={{ headerShown: true, title: 'Reseña' }} />
      {/* Mi biblioteca: las pantallas de detalle no llevan título porque ya muestran el nombre. */}
      <Stack.Screen name="Collections" component={CollectionsScreen} options={{ headerShown: true, title: 'Colecciones' }} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen
        name="CollectionForm"
        component={CollectionFormScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.collectionId ? 'Editar colección' : 'Nueva colección',
        })}
      />
      <Stack.Screen name="Series" component={SeriesListScreen} options={{ headerShown: true, title: 'Sagas' }} />
      <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Authors" component={AuthorsScreen} options={{ headerShown: true, title: 'Autores' }} />
      <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} options={{ headerShown: true, title: '' }} />
    </Stack.Navigator>
  );
}
