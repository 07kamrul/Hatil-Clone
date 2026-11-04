import { CategoryNode } from '../../core/models';

/** Items always shown in the desktop nav. */
export const NAV_ALWAYS_VISIBLE = 7;
/** Items shown on very wide (2xl) screens; the extras collapse into "More" below that. */
export const NAV_MAX_VISIBLE = 10;

export interface NavItem {
  readonly node: CategoryNode;
  /** True when the item only fits on 2xl screens (hidden in nav / shown in More otherwise). */
  readonly isWideOnly: boolean;
}

export interface NavSplit {
  readonly visible: readonly NavItem[];
  /** Items listed in the "More" menu; `isWideOnly` items there are hidden on 2xl screens. */
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
