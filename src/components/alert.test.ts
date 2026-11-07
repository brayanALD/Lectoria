import { Alert, Platform } from 'react-native';

import { showAlert, subscribeToAlerts, type AlertRequest } from './alert';

describe('showAlert', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    jest.restoreAllMocks();
  });
  const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { value: os });

  it('en el móvil usa el diálogo nativo con los mismos argumentos', () => {
    const native = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const buttons = [{ text: 'Cancelar', style: 'cancel' as const }, { text: 'Eliminar', style: 'destructive' as const }];
    setPlatform('android');
    showAlert('¿Eliminar?', 'No se puede deshacer.', buttons, { cancelable: true });
    expect(native).toHaveBeenCalledWith('¿Eliminar?', 'No se puede deshacer.', buttons, { cancelable: true });
  });

  it('en la web entrega la pregunta al diálogo propio y no abre el nativo (que en la web no hace nada)', () => {
    const native = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const received: AlertRequest[] = [];
    const unsubscribe = subscribeToAlerts((request) => received.push(request));
    setPlatform('web');
    const onDismiss = jest.fn();
    showAlert('Ya tienes «Dune»', '¿Añadirlo de todos modos?', [{ text: 'Cancelar' }, { text: 'Añadir' }], { onDismiss });

    expect(native).not.toHaveBeenCalled();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ title: 'Ya tienes «Dune»', message: '¿Añadirlo de todos modos?' });
    expect(received[0].buttons.map((button) => button.text)).toEqual(['Cancelar', 'Añadir']);
    received[0].onDismiss?.();
    expect(onDismiss).toHaveBeenCalled();
    unsubscribe();
  });

  it('un aviso sin botones lleva uno de «Aceptar», como el nativo', () => {
    const received: AlertRequest[] = [];
    const unsubscribe = subscribeToAlerts((request) => received.push(request));
    setPlatform('web');
    showAlert('Listo');
    expect(received[0].buttons).toEqual([{ text: 'Aceptar' }]);
    unsubscribe();
  });

  it('en la web, sin diálogo montado, recurre al nativo en lugar de perder la pregunta', () => {
    const native = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setPlatform('web');
    showAlert('Hola');
    expect(native).toHaveBeenCalledTimes(1);
  });
});
