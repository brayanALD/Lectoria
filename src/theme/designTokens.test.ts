import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Guarda del principio de «uso estricto de design tokens»: los valores de diseño se escriben solo en
// src/theme/ y el resto del código los usa por nombre. Si esta prueba falla, hay un valor «quemado».

interface Violation {
  rule: string;
  text: string;
}

const RULES: { rule: string; pattern: RegExp }[] = [
  { rule: 'color hexadecimal fuera de theme/colors.ts', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { rule: 'color rgb/rgba/hsl fuera de theme/colors.ts', pattern: /\b(?:rgba?|hsla?)\s*\(/ },
  {
    rule: 'color con nombre (usa un token de colors)',
    pattern: /[cC]olor['"]?\s*:\s*['"](?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)['"]/,
  },
  { rule: 'fontSize numérico (usa fontSize.*)', pattern: /fontSize\s*:\s*\d/ },
  { rule: 'fontWeight (el peso se expresa con fontFamily.*)', pattern: /\bfontWeight\s*:/ },
  { rule: 'opacity numérica (usa opacity.*)', pattern: /\bopacity\s*:\s*[\d.]/ },
  { rule: 'tamaño de icono numérico (usa iconSize.*)', pattern: /\bsize=\{\s*\d/ },
];

/** Quita los comentarios para no marcar como violación un color citado en un comentario. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function findViolations(source: string): Violation[] {
  const code = stripComments(source);
  return code
    .split('\n')
    .flatMap((line) => RULES.filter(({ pattern }) => pattern.test(line)).map(({ rule }) => ({ rule, text: line.trim() })));
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(test|d)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('detector de valores quemados', () => {
  it.each([
    ["color: '#FFFFFF'", 'color hexadecimal'],
    ["backgroundColor: 'rgba(0, 0, 0, 0.5)'", 'color rgb/rgba'],
    ["color: 'white'", 'color con nombre'],
    ['fontSize: 14', 'fontSize numérico'],
    ['fontWeight: \'700\'', 'fontWeight'],
    ['{ opacity: 0.5 }', 'opacity numérica'],
    ['<Ionicons name="add" size={24} />', 'tamaño de icono'],
  ])('detecta %s', (line, expected) => {
    expect(findViolations(line).map((v) => v.rule).join(' ')).toContain(expected);
  });

  it.each([
    'color: colors.textPrimary',
    'fontSize: fontSize.md',
    'fontFamily: fontFamily.semibold',
    'opacity: opacity.pressed',
    '<Ionicons name="add" size={iconSize.md} />',
    "// el color #14281D es Evergreen",
    "const url = 'https://ejemplo.com/#/ruta';".replace('#/ruta', ''),
  ])('no marca %s', (line) => {
    expect(findViolations(line)).toEqual([]);
  });
});

describe('código de la aplicación', () => {
  const root = join(__dirname, '..');
  const files = sourceFiles(root).filter((file) => relative(root, file).replace(/\\/g, '/') !== 'theme/colors.ts');

  it('encuentra los archivos a revisar', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no tiene colores ni valores de diseño escritos a mano fuera de src/theme', () => {
    const violations = files.flatMap((file) =>
      findViolations(readFileSync(file, 'utf8')).map((v) => `${relative(root, file)}: ${v.rule} → ${v.text}`),
    );
    expect(violations).toEqual([]);
  });
});

/** Rango del objeto literal `{ ... }` más cercano que contiene `index` (para revisar un estilo completo). */
function enclosingObject(code: string, index: number): string | undefined {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i--) {
    if (code[i] === '}') depth++;
    else if (code[i] === '{') {
      if (depth === 0) {
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start < 0) return undefined;
  depth = 0;
  for (let j = start; j < code.length; j++) {
    if (code[j] === '{') depth++;
    else if (code[j] === '}' && --depth === 0) return code.slice(start, j + 1);
  }
  return undefined;
}

/** Estilos de texto (los que fijan `fontSize`) que no fijan también `fontFamily`: saldrían con la fuente del sistema. */
export function findTextStylesWithoutFamily(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  for (const match of code.matchAll(/fontSize\s*:/g)) {
    const object = enclosingObject(code, match.index ?? 0);
    if (object && !/fontFamily\s*:/.test(object)) found.push(object.replace(/\s+/g, ' ').slice(0, 80));
  }
  return found;
}

describe('tipografía: todo estilo de texto lleva su familia', () => {
  it('detecta un estilo con fontSize y sin fontFamily', () => {
    expect(findTextStylesWithoutFamily('const a = { fontSize: fontSize.md, color: colors.textPrimary };')).toHaveLength(1);
  });

  it('acepta un estilo con las dos cosas', () => {
    expect(findTextStylesWithoutFamily('const a = { fontSize: fontSize.md, fontFamily: fontFamily.regular };')).toEqual([]);
  });

  it('todo estilo de texto de src/ fija fontFamily (si no, saldría con la fuente del sistema)', () => {
    const root = join(__dirname, '..');
    const files = sourceFiles(root).filter((file) => relative(root, file).replace(/\\/g, '/') !== 'theme/colors.ts');
    const missing = files.flatMap((file) =>
      findTextStylesWithoutFamily(readFileSync(file, 'utf8')).map((text) => `${relative(root, file)}: ${text}`),
    );
    expect(missing).toEqual([]);
  });
});
