import { wrapIndex } from './blog-detail';

describe('wrapIndex', () => {
  it('returns null when there are no photos', () => {
    expect(wrapIndex(0, 1, 0)).toBeNull();
  });

  it('steps forward within range', () => {
    expect(wrapIndex(0, 1, 3)).toBe(1);
    expect(wrapIndex(1, 1, 3)).toBe(2);
  });

  it('wraps forward past the last photo', () => {
    expect(wrapIndex(2, 1, 3)).toBe(0);
  });

  it('wraps backward past the first photo', () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
  });

  it('steps backward within range', () => {
    expect(wrapIndex(2, -1, 3)).toBe(1);
  });
});
