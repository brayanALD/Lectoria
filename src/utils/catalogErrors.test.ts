import { ISBN_NOT_FOUND_MESSAGE, getCatalogErrorMessage } from './catalogErrors';

describe('getCatalogErrorMessage', () => {
  it('traduce los errores propios del catálogo', () => {
    expect(getCatalogErrorMessage({ code: 'lectoria/catalog-unavailable' })).toMatch(/conexión/);
    expect(getCatalogErrorMessage({ code: 'lectoria/catalog-rate-limited' })).toMatch(/Espera/);
  });

  it('en cualquier otro caso invita a rellenar los datos a mano', () => {
    expect(getCatalogErrorMessage(new Error('x'))).toMatch(/a mano/);
    expect(getCatalogErrorMessage(null)).toMatch(/a mano/);
  });

  it('el mensaje de ISBN no encontrado indica la alternativa', () => {
    expect(ISBN_NOT_FOUND_MESSAGE).toMatch(/a mano/);
  });
});
