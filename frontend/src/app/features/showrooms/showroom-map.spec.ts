import { describe, expect, it } from 'vitest';

import { Showroom } from '../../core/models';
import { pickActiveShowroom } from './showroom-map';

const room = (id: number, lat: number | null): Showroom => ({ id, latitude: lat, longitude: lat }) as Showroom;

describe('pickActiveShowroom', () => {
  const rooms = [room(1, null), room(2, 25.3), room(3, 25.4)];

  it('returns the selected showroom when it has coordinates', () => {
    expect(pickActiveShowroom(rooms, 3)?.id).toBe(3);
  });

  it('falls back to the first located showroom when nothing is selected', () => {
    expect(pickActiveShowroom(rooms, null)?.id).toBe(2);
  });

  it('falls back to a showroom without coordinates so the address embed can render', () => {
    expect(pickActiveShowroom([room(1, null)], null)?.id).toBe(1);
    expect(pickActiveShowroom([room(1, null)], 1)?.id).toBe(1);
    expect(pickActiveShowroom([room(1, null), room(2, 25.3)], 1)?.id).toBe(1);
  });
});
