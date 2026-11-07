import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

// Vive junto a `AlertHost` y no en `utils/`: depende de React Native, y `src/utils` lo comparte la API (ver CLAUDE.md).

/** Una pregunta o aviso pendiente de mostrar en la web (ver `AlertHost`). */
export interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Se llama si la persona cierra el diálogo sin elegir un botón. */
  onDismiss?: () => void;
}

let listener: ((request: AlertRequest) => void) | undefined;

/** `AlertHost` se suscribe aquí para pintar los diálogos de la web. Devuelve la función que cancela la suscripción. */
export function subscribeToAlerts(next: (request: AlertRequest) => void): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = undefined;
  };
}

/**
 * Mismo contrato que `Alert.alert` de React Native. En el móvil abre el diálogo nativo. En la web, `Alert.alert` de
 * React Native no hace nada (react-native-web lo deja vacío), así que se pinta un diálogo propio con el tema de la app.
 * Siempre hay que usar esta función en lugar de `Alert.alert` directamente.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  if (Platform.OS !== 'web' || !listener) {
    Alert.alert(title, message, buttons, options);
    return;
  }
  listener({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'Aceptar' }],
    onDismiss: options?.onDismiss,
  });
}
