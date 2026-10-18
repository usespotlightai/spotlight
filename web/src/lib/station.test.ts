import { describe, expect, it } from 'vitest';
import { stationShare } from '@/lib/station';

describe('stationShare', () => {
  it('leaves the first station empty, having nothing behind it', () => {
    expect(stationShare(0, 5)).toBe(0);
  });

  it('fills the last station whole', () => {
    expect(stationShare(4, 5)).toBe(1);
  });

  it('divides the ones between by how far along they are', () => {
    expect([1, 2, 3].map((place) => stationShare(place, 5))).toEqual([
      0.25, 0.5, 0.75,
    ]);
  });

  it('fills a line of one, which is both its start and its end', () => {
    expect(stationShare(0, 1)).toBe(1);
  });
});
