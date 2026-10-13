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
    ['{ opacity: 0.5 }', 'opacity numérica'],
    ['<Ionicons name="add" size={24} />', 'tamaño de icono'],
  ])('detecta %s', (line, expected) => {
    expect(findViolations(line).map((v) => v.rule).join(' ')).toContain(expected);
  });

  it.each([
    'color: colors.textPrimary',
    'fontSize: fontSize.md',
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
