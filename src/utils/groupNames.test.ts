import { groupByName } from './groupNames';

const names = (item: { names: string[] }) => item.names;

describe('groupByName', () => {
  it('une los nombres que solo se diferencian en tildes, mayúsculas o espacios', () => {
    const groups = groupByName([{ names: ['José Saramago'] }, { names: ['jose  saramago'] }, { names: ['Julio Cortázar'] }], names);
    expect(groups.map((group) => [group.key, group.items.length])).toEqual([
      ['jose saramago', 2],
      ['julio cortazar', 1],
    ]);
  });

  it('muestra la grafía más repetida y, si empatan, la primera que apareció', () => {
    const repeated = groupByName([{ names: ['jose saramago'] }, { names: ['José Saramago'] }, { names: ['José Saramago'] }], names);
    expect(repeated[0].name).toBe('José Saramago');

    const tie = groupByName([{ names: ['Dune'] }, { names: ['dune'] }], names);
    expect(tie[0].name).toBe('Dune');
  });

  it('cuenta una sola vez un elemento que repite el nombre', () => {
    const groups = groupByName([{ names: ['Ana', 'ana', ' ANA '] }], names);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  it('un elemento con varios nombres aparece en cada grupo', () => {
    const book = { names: ['Neil Gaiman', 'Terry Pratchett'] };
    const groups = groupByName([book], names);
    expect(groups.map((group) => group.name)).toEqual(['Neil Gaiman', 'Terry Pratchett']);
    expect(groups.every((group) => group.items[0] === book)).toBe(true);
  });

  it('ignora los nombres vacíos y ordena en español', () => {
    const groups = groupByName([{ names: ['', '   ', 'Óscar'] }, { names: ['Zeta'] }, { names: ['Ana'] }], names);
    expect(groups.map((group) => group.name)).toEqual(['Ana', 'Óscar', 'Zeta']);
  });

  it('con una lista vacía no devuelve grupos', () => {
    expect(groupByName([], names)).toEqual([]);
  });
});
