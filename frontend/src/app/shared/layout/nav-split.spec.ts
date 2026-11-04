import { CategoryNode } from '../../core/models';
import { splitNav } from './nav-split';

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
