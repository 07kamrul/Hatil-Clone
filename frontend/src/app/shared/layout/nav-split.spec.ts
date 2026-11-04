import { CategoryNode } from '../../core/models';
import { orderNav, splitNav } from './nav-split';

const node = (id: number): CategoryNode =>
  ({ id, name: `C${id}`, slug: `c${id}`, children: [] }) as unknown as CategoryNode;
const tree = (n: number): CategoryNode[] => Array.from({ length: n }, (_, i) => node(i + 1));

describe('splitNav', () => {
  it('shows everything without overflow when the tree is short', () => {
    const r = splitNav(tree(5));
    expect(r.visible.map((v) => v.node.id)).toEqual([1, 2, 3, 4, 5]);
    expect(r.overflow).toEqual([]);
    expect(r.visible.every((v) => !v.isWideOnly)).toBe(true);
  });

  it('marks items 8-10 as wide-only and puts them plus the rest in overflow', () => {
    const r = splitNav(tree(13));
    expect(r.visible).toHaveLength(10);
    expect(r.visible.filter((v) => v.isWideOnly).map((v) => v.node.id)).toEqual([8, 9, 10]);
    expect(r.overflow.map((v) => v.node.id)).toEqual([8, 9, 10, 11, 12, 13]);
    expect(r.overflow.filter((v) => !v.isWideOnly).map((v) => v.node.id)).toEqual([11, 12, 13]);
  });

  it('handles an empty tree', () => {
    expect(splitNav([])).toEqual({ visible: [], overflow: [] });
  });
});

describe('orderNav', () => {
  const named = (id: number, name: string, slug = name.toLowerCase().replace(/\W+/g, '-')): CategoryNode =>
    ({ id, name, slug, children: [] }) as unknown as CategoryNode;

  it('puts Hatil-named categories first in Hatil order, then the rest in original order', () => {
    const r = orderNav([named(1, 'Side Table'), named(2, 'OFFICE'), named(3, 'Living Room'), named(4, 'Bed Cum Divan'), named(5, 'Bedroom')]);
    expect(r.map((n) => n.id)).toEqual([3, 5, 2, 1, 4]);
  });

  it("uses Hatil's spelling as the label and matches ignoring case and punctuation", () => {
    const r = orderNav([named(1, 'KIDS ROOM'), named(2, 'smart fit')]);
    expect(r.map((n) => n.name)).toEqual(["Kid's Room", 'SmartFit']);
  });

  it('matches on slug when the name differs', () => {
    expect(orderNav([named(9, 'Doors & Frames', 'door')])[0].name).toBe('Door');
  });

  it('does not mutate the input nodes', () => {
    const input = [named(1, 'KIDS ROOM')];
    orderNav(input);
    expect(input[0].name).toBe('KIDS ROOM');
  });
});
