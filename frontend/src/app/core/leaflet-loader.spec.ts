import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeLeafletModule, pinIcon } from './leaflet-loader';

type Leaflet = typeof import('leaflet');
const fakeLeaflet = (): Leaflet => ({ map: vi.fn() }) as unknown as Leaflet;

describe('normalizeLeafletModule', () => {
  it('unwraps a UMD-style default export', () => {
    const lib = fakeLeaflet();
    expect(normalizeLeafletModule({ default: lib })).toBe(lib);
  });

  it('passes through a namespace without a default export', () => {
    const lib = fakeLeaflet();
    expect(normalizeLeafletModule(lib)).toBe(lib);
  });
});

describe('loadLeaflet', () => {
  let loadLeaflet: typeof import('./leaflet-loader').loadLeaflet;

  beforeEach(async () => {
    vi.resetModules(); // fresh promise cache per case
    ({ loadLeaflet } = await import('./leaflet-loader'));
  });

  it('normalizes what the dynamic import returns', async () => {
    const lib = fakeLeaflet();
    expect(await loadLeaflet(() => Promise.resolve({ default: lib }))).toBe(lib);
  });

  it('caches a successful load', async () => {
    const importer = vi.fn(() => Promise.resolve({ default: fakeLeaflet() }));
    const first = await loadLeaflet(importer);
    expect(await loadLeaflet(importer)).toBe(first);
    expect(importer).toHaveBeenCalledOnce();
  });

  it('does not cache a rejected import, so retries get a fresh attempt', async () => {
    const lib = fakeLeaflet();
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('chunk load failed'))
      .mockResolvedValueOnce({ default: lib });
    await expect(loadLeaflet(importer)).rejects.toThrow('chunk load failed');
    expect(await loadLeaflet(importer)).toBe(lib);
    expect(importer).toHaveBeenCalledTimes(2);
  });
});

describe('pinIcon', () => {
  it('builds a div icon centred on the styled span', () => {
    const lib = { divIcon: (opts: unknown) => opts } as unknown as Leaflet;
    const icon = pinIcon(lib) as unknown as { iconSize: number[]; iconAnchor: number[]; html: string };
    expect(icon.iconSize).toEqual([22, 22]);
    expect(icon.iconAnchor).toEqual([11, 11]);
    expect(icon.html).toContain('border-radius:9999px');
  });
});
