import { describe, expect, it } from 'vitest';

import { parseGoogleMapsLink } from '../../../core/maps-link';
import { maplinkCoords } from './resource-form';

describe('maplinkCoords', () => {
  it('passes saved coordinates through as numbers', () => {
    expect(maplinkCoords({ latitude: 25.3216, longitude: 55.4018 }, ['latitude', 'longitude']))
      .toEqual({ latitude: 25.3216, longitude: 55.4018 });
  });

  it('maps empty and unsaved values to null', () => {
    expect(maplinkCoords({ latitude: '', longitude: null, x: undefined }, ['latitude', 'longitude', 'x']))
      .toEqual({ latitude: null, longitude: null, x: null });
  });

  it('converts manual string input from the number fields', () => {
    expect(maplinkCoords({ latitude: '25.3', longitude: '55.4' }, ['latitude', 'longitude']))
      .toEqual({ latitude: 25.3, longitude: 55.4 });
  });
});

describe('showroom maps link → coordinates', () => {
  it('reads coordinates from a full Google Maps link', () => {
    const point = parseGoogleMapsLink('https://www.google.com/maps/place/Sahat/@25.3216,55.4018,15z');
    expect(point).toEqual({ lat: 25.3216, lng: 55.4018 });
  });

  it('returns null for short share links, which need the backend resolve endpoint', () => {
    expect(parseGoogleMapsLink('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
  });
});
