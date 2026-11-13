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
    expect(candidate?.y).toBe(127);
  });

  it('stacks a third label above the first once above and below are both taken', () => {
    const placed = placeLabels([
      { key: 'a', text: 'first', x: 100, y: 100 },
      { key: 'b', text: 'second', x: 100, y: 100 },
      { key: 'c', text: 'third', x: 100, y: 100 },
    ]);

    expect(placed[2]?.y).toBe(71);
  });
});

describe('placeLabels within the plot', () => {
  it('moves a label that would run past the plot’s left edge', () => {
    const [label] = placeLabels(
      [{ key: 'a', text: 'Claude Code, haiku, low effort', x: 4, y: 100 }],
      { left: 0, right: 400, top: 0, bottom: 300 },
    );

    expect(label?.anchor).toBe('start');
  });

  it('keeps a label at the plot’s bottom edge above its point, off the axis', () => {
    const [label] = placeLabels(
      [{ key: 'a', text: 'Claude Code, haiku, low effort', x: 200, y: 296 }],
      { left: 0, right: 400, top: 0, bottom: 300 },
    );

    expect(label?.y).toBeLessThan(296);
  });

  it('keeps a label at the plot’s top edge below its point', () => {
    const [label] = placeLabels(
      [{ key: 'a', text: 'Live config', x: 200, y: 4 }],
      { left: 0, right: 400, top: 0, bottom: 300 },
    );

    expect(label?.y).toBeGreaterThan(4);
  });
});

describe('placeLabels when the plot is crowded', () => {
  it('leaves out a label that has no free spot, so the tooltip names it', () => {
    const points = Array.from({ length: 8 }, (_, index) => ({
      key: 'point-' + index,
      text: 'Claude Code, sonnet, high',
      x: 150 + index * 4,
      y: 100,
    }));

    const placed = placeLabels(points, {
      left: 0,
      right: 300,
      top: 0,
      bottom: 300,
    });

    expect(placed.length).toBeLessThan(points.length);
    expect(placed[0]?.key).toBe('point-0');
  });

  it('keeps a label off another point', () => {
    const [label] = placeLabels([
      { key: 'a', text: 'Live config', x: 100, y: 100 },
      { key: 'b', text: 'opus', x: 100, y: 88 },
    ]);

    expect(label?.y).toBe(127);
  });
});
