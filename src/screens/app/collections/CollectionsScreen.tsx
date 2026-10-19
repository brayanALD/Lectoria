import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import { RowListSkeleton } from '../../../components/ListSkeletons';
import { NavRowList } from '../../../components/NavRowList';
import { makeStyles, useTheme } from '../../../context/ThemeContext';
import { useBooks } from '../../../hooks/useBooks';
import { useCollections } from '../../../hooks/useCollections';
import type { AppStackParamList } from '../../../navigation/types';
import { iconSize, minTouchSize, opacity } from '../../../theme/spacing';
import { describeCollection } from '../../../utils/collections';

type Props = NativeStackScreenProps<AppStackParamList, 'Collections'>;

/** Las colecciones (libros elegidos a mano) y las estanterías filtradas, juntas y por nombre. */
export function CollectionsScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { collections, loading, error, retry } = useCollections();
  const { books, loading: booksLoading } = useBooks();
  const openForm = () => navigation.navigate('CollectionForm');

  // «Nueva colección» en el encabezado: visible también mientras carga o si hay un error.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva colección"
          onPress={openForm}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={iconSize.lg} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, styles, colors]);

  const items = useMemo(
    () =>
      collections.map((collection) => ({
        id: collection.id,
        title: collection.name,
        subtitle: describeCollection(collection, books),
        icon: (collection.kind === 'filter' ? 'funnel-outline' : 'albums-outline') as 'funnel-outline' | 'albums-outline',
      })),
    [collections, books],
  );

  if (loading || booksLoading) return <RowListSkeleton label="Cargando colecciones" icons />;

  if (error && collections.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudieron cargar tus colecciones"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (collections.length === 0) {
    return <EmptyState icon="albums-outline" title="Aún no tienes colecciones" action={{ label: 'Crear colección', onPress: openForm }} />;
  }

  return <NavRowList items={items} onOpen={(collectionId) => navigation.navigate('CollectionDetail', { collectionId })} />;
}

const useStyles = makeStyles(() => StyleSheet.create({
  headerButton: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
}));
