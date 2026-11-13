import { describe, expect, it } from 'vitest';

import {
  bucketOf,
  changedLines,
  diffShape,
  median,
  stackShape,
} from './stack-metrics';

const patchOf = (added: number, removed = 0): string =>
  [
    `@@ -1,${removed} +1,${added} @@`,
    ' context',
    ...Array.from({ length: removed }, () => '-old'),
    ...Array.from({ length: added }, () => '+new'),
  ].join('\n');

const HUNKS = [
  { id: 'h1', path: 'a.ts', patch: patchOf(300) },
  { id: 'h2', path: 'a.ts', patch: patchOf(50, 50) },
  { id: 'h3', path: 'b.ts', patch: patchOf(100) },
  { id: 'h4', path: 'package-lock.json', patch: patchOf(5000) },
];

const PLACED = new Set(['h1', 'h2', 'h3']);

describe('changedLines', () => {
  it('counts added and removed lines, not the header or context', () => {
    expect(changedLines(patchOf(3, 2))).toBe(5);
  });
});

describe('diffShape', () => {
  it('measures only the hunks the model places', () => {
    expect(diffShape(HUNKS, PLACED)).toEqual({
      hunks: 3,
      lines: 500,
      files: 2,
      largestHunkLines: 300,
      largestHunkShare: 0.6,
      bucket: 'medium',
    });
  });
});

describe('stackShape', () => {
  it('gives one layer the whole change when the stack has one layer', () => {
    const shape = stackShape(HUNKS, PLACED, [
      {
        kind: 'change',
        title: 'All',
        layers: [
          {
            title: 'Everything',
            hunks: [
              { hunk: 'h1' },
              { hunk: 'h2' },
              { hunk: 'h3' },
              { hunk: 'h4' },
            ],
          },
        ],
      },
    ]);

    expect(shape.largestLayerShare).toBe(1);
    expect(shape.effectiveLayers).toBe(1);
    expect(shape.oversizedLayers).toBe(1);
    expect(shape.layerLines).toEqual([500]);
  });

  it('counts layers of equal size as that many effective layers', () => {
    const shape = stackShape(
      [
        { id: 'h1', path: 'a.ts', patch: patchOf(100) },
        { id: 'h2', path: 'b.ts', patch: patchOf(100) },
      ],
      new Set(['h1', 'h2']),
      [
        {
          kind: 'change',
          title: 'Two',
          layers: [
            { title: 'One', hunks: [{ hunk: 'h1' }] },
            { title: 'Two', hunks: [{ hunk: 'h2' }] },
          ],
        },
      ],
    );

    expect(shape.effectiveLayers).toBe(2);
    expect(shape.largestLayerShare).toBe(0.5);
    expect(shape.oversizedLayers).toBe(0);
  });

  it('leaves incidental cohorts out of the layers and reports their share', () => {
    const shape = stackShape(HUNKS, PLACED, [
      {
        kind: 'change',
        title: 'Work',
        layers: [{ title: 'A', hunks: [{ hunk: 'h1' }, { hunk: 'h2' }] }],
      },
      {
        kind: 'incidental',
        title: 'Noise',
        layers: [{ title: 'B', hunks: [{ hunk: 'h3' }] }],
      },
    ]);

    expect(shape.layers).toBe(1);
    expect(shape.incidentalShare).toBe(0.2);
  });
});

describe('bucketOf', () => {
  it('sorts diffs by changed lines', () => {
    expect([bucketOf(299), bucketOf(300), bucketOf(1500)]).toEqual([
      'small',
      'medium',
      'large',
    ]);
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
