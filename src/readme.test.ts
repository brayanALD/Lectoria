import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Guarda del README: no puede citar comandos que no existen, olvidar fases, apuntar a carpetas inexistentes
// ni publicar secretos (el repositorio es público). Ver «Mantenimiento de documentación» en CLAUDE.md.

const root = join(__dirname, '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const scripts: Record<string, string> = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;

describe('README.md', () => {
  it('solo cita scripts de npm que existen en package.json', () => {
    const cited = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1]);
    expect(cited.length).toBeGreaterThan(0);
    for (const script of cited) expect(Object.keys(scripts)).toContain(script);
  });

  it('incluye `npm test`, que es un script estándar', () => {
    expect(readme).toContain('`npm test`');
    expect(scripts.test).toBeTruthy();
  });

  it('lista las siete fases del plan, cada una con un estado', () => {
    const rows = [...readme.matchAll(/^\| (\d)\. [^|]+\|[^|]+\| ([^|]+) \|$/gm)];
    expect(rows.map((row) => Number(row[1]))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const row of rows) expect(row[2].trim()).toMatch(/^(Cerrada|En curso|Pendiente)/);
  });

  it('las fases se cierran en orden (no hay una pendiente antes de una cerrada)', () => {
    const states = [...readme.matchAll(/^\| \d\. [^|]+\|[^|]+\| (Cerrada|En curso|Pendiente)/gm)].map((m) => m[1]);
    const firstOpen = states.findIndex((state) => state !== 'Cerrada');
    expect(states.slice(firstOpen === -1 ? states.length : firstOpen).includes('Cerrada')).toBe(false);
  });

  it('las carpetas de src/ que muestra existen', () => {
    const block = readme.split('```text')[1]?.split('```')[0] ?? '';
    const folders = [...block.matchAll(/^[├└]── (\w+)\//gm)].map((match) => match[1]);
    expect(folders.length).toBeGreaterThan(5);
    for (const folder of folders) expect(existsSync(join(root, 'src', folder))).toBe(true);
  });

  it('enlaza a archivos del repositorio que existen', () => {
    const links = [...readme.matchAll(/\]\(([^)#:]+)\)/g)].map((match) => match[1]);
    for (const link of links) expect(existsSync(join(root, link))).toBe(true);
  });

  it('no contiene secretos ni datos personales (el repositorio es público)', () => {
    expect(readme).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
    expect(readme).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(readme).not.toMatch(/GOCSPX-/);
    expect(readme).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // ningún correo electrónico
    expect(readme).not.toMatch(/C:\\Users\\/); // ninguna ruta local
  });
});
