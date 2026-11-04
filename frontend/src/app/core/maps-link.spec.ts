import { describe, expect, it } from 'vitest';

import { mapDirectionsUrl, mapEmbedUrl, parseGoogleMapsLink } from './maps-link';

describe('parseGoogleMapsLink', () => {
  it('reads @lat,lng place links', () => {
    expect(parseGoogleMapsLink('https://www.google.com/maps/place/Dubai/@25.2048,55.2708,15z'))
      .toEqual({ lat: 25.2048, lng: 55.2708 });
  });

  it('reads query links', () => {
    expect(parseGoogleMapsLink('https://maps.google.com/?q=25.2048,55.2708'))
      .toEqual({ lat: 25.2048, lng: 55.2708 });
    expect(parseGoogleMapsLink('https://www.google.com/maps/dir/?api=1&destination=25.2048,55.2708'))
      .toEqual({ lat: 25.2048, lng: 55.2708 });
  });

  it('reads place !3d!4d links', () => {
    expect(parseGoogleMapsLink('https://www.google.com/maps/place/Shop/!3d25.2048!4d55.2708!5m1'))
      .toEqual({ lat: 25.2048, lng: 55.2708 });
  });

  it('rejects non-google and coord-less links', () => {
    expect(parseGoogleMapsLink('https://evil.example.com/@25.2,55.2')).toBeNull();
    expect(parseGoogleMapsLink('https://maps.app.goo.gl/xYz123')).toBeNull();
    expect(parseGoogleMapsLink('https://www.google.com/maps/place/Somewhere')).toBeNull();
  });

  it('rejects out-of-range coords', () => {
    expect(parseGoogleMapsLink('https://www.google.com/maps?q=999,55.2')).toBeNull();
  });
});

describe('url builders', () => {
  const point = { lat: 25.32, lng: 55.4 };

  it('builds embed url', () => {
    expect(mapEmbedUrl(point, 15)).toBe('https://www.google.com/maps?q=25.32,55.4&z=15&hl=en&output=embed');
  });

  it('builds directions url', () => {
    expect(mapDirectionsUrl(point)).toBe('https://www.google.com/maps/dir/?api=1&destination=25.32,55.4');
  });
});
