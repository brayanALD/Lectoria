// Identificador de una creación que se puede repetir sin duplicarla. La API usa `requestId` como id del documento: si la
// primera petición sí llegó pero la respuesta se perdió (corte de red, tiempo agotado), el reintento con el MISMO id
// devuelve lo ya creado en lugar de crear otro. Si la persona cambia algo antes de reintentar, el id cambia (la API no
// debe devolverle una versión antigua).

/** Un identificador nuevo para una pantalla o formulario («la intención de crear esto»). Cumple `[A-Za-z0-9_-]{8,100}`. */
export function newRequestSeed(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${random()}${random()}`;
}

/** Hash de 32 bits (djb2) de un texto, en base 36. No es criptográfico: solo distingue un contenido de otro. */
function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index++) value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  return (value >>> 0).toString(36);
}

/** Serializa con las claves ordenadas, para que el mismo contenido dé siempre el mismo texto. */
function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * El `requestId` de un intento: el de la pantalla (`seed`) más una huella de lo que se envía. Reintentar sin cambiar nada
 * da el mismo id; cambiar cualquier dato da otro.
 */
export function makeRequestId(seed: string, payload: unknown): string {
  return `${seed}-${hash(stableStringify(payload))}`.slice(0, 100);
}
