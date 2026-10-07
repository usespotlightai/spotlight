import { describe, expect, it } from 'vitest';
import { placeLabels } from '@/lib/point-labels';

describe('placeLabels', () => {
  it('sets every label above its point where none collide', () => {
    expect(
      placeLabels([
        { key: 'a', text: 'Live config', x: 100, y: 100 },
        { key: 'b', text: 'opus', x: 300, y: 100 },
      ]).map((label) => [label.anchor, label.y]),
    ).toEqual([
      ['middle', 85],
      ['middle', 85],
    ]);
  });

  it('nudges a label below its point where the one above is taken', () => {
    const [live, candidate] = placeLabels([
      { key: 'live', text: 'Live config', x: 100, y: 100 },
      { key: 'one', text: 'one-comment-per-problem', x: 100, y: 100 },
    ]);

    expect(live?.y).toBe(85);
    expect(candidate?.y).toBe(126);
  });

  it('stacks a third label above the first once above and below are both taken', () => {
    const placed = placeLabels([
      { key: 'a', text: 'first', x: 100, y: 100 },
      { key: 'b', text: 'second', x: 100, y: 100 },
      { key: 'c', text: 'third', x: 100, y: 100 },
    ]);

    expect(placed[2]?.y).toBe(72);
  });
});
