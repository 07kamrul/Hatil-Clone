import { CategoryNode } from '../../core/models';

/** Items always shown in the desktop nav. */
export const NAV_ALWAYS_VISIBLE = 7;
/** Items shown on xl+ screens; the extras collapse into "More" below that. */
export const NAV_MAX_VISIBLE = 10;

/** hatil.com's top-nav order and spelling; matched loosely against category names/slugs. */
export const NAV_ORDER: readonly string[] = [
  'Living Room', 'Bedroom', 'Dining', 'Kitchen', "Kid's Room", 'SmartFit', 'Institutional', 'Door', 'Interior', 'Office',
];

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Reorders categories: NAV_ORDER matches first (relabelled), the rest after in original order. Never mutates input. */
export function orderNav(tree: readonly CategoryNode[]): CategoryNode[] {
  const used = new Set<number>();
  const matched: CategoryNode[] = [];
  for (const label of NAV_ORDER) {
    const key = normalize(label);
    const hit = tree.find((n) => !used.has(n.id) && (normalize(n.name) === key || normalize(n.slug) === key));
    if (hit) {
      used.add(hit.id);
      matched.push({ ...hit, name: label });
    }
  }
  return [...matched, ...tree.filter((n) => !used.has(n.id))];
}

export interface NavItem {
  readonly node: CategoryNode;
  /** True when the item only fits on xl+ screens (hidden in nav / shown in More otherwise). */
  readonly isWideOnly: boolean;
}

export interface NavSplit {
  readonly visible: readonly NavItem[];
  /** Items listed in the "More" menu; `isWideOnly` items there are hidden on xl+ screens. */
  readonly overflow: readonly NavItem[];
}

export function splitNav(
  tree: readonly CategoryNode[],
  alwaysVisible = NAV_ALWAYS_VISIBLE,
  maxVisible = NAV_MAX_VISIBLE,
): NavSplit {
  const items = tree.map((node, i) => ({ node, isWideOnly: i >= alwaysVisible && i < maxVisible }));
  return {
    visible: items.slice(0, maxVisible),
    overflow: items.slice(alwaysVisible),
  };
}
