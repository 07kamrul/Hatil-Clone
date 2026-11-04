import type * as L from 'leaflet';

let cached: Promise<typeof L> | null = null;

/**
 * Leaflet ships as UMD, so under esbuild a dynamic `import('leaflet')` exposes
 * the library on `.default` while an ESM build keeps it on the namespace.
 */
export function normalizeLeafletModule(mod: { default?: typeof L } | typeof L): typeof L {
  return 'default' in mod && mod.default ? (mod.default as typeof L) : (mod as typeof L);
}

/**
 * Lazy, browser-only Leaflet loader; caches the result for repeated use. A
 * failed load is not cached so callers can retry.
 */
export function loadLeaflet(
  importModule: () => Promise<{ default?: typeof L } | typeof L> = () => import('leaflet'),
): Promise<typeof L> {
  cached ??= importModule()
    .then(normalizeLeafletModule)
    .catch((error: unknown) => {
      cached = null; // a failed load must not poison retries
      throw error;
    });
  return cached;
}

/** Round-trippable pin icon built from a styled div (no image assets needed). */
export function pinIcon(Lf: typeof L, color = 'var(--color-brand)'): L.DivIcon {
  return Lf.divIcon({
    className: '',
    html:
      `<span style="display:block;width:22px;height:22px;border-radius:9999px;` +
      `background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
