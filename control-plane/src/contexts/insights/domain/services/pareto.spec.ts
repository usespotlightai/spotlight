import { paretoFrontier } from '@insights/domain/services/pareto';
import { describe, expect, it } from 'vitest';

describe('paretoFrontier', () => {
  const points = [
    { id: 'cheap-poor', cost: 1, value: 0.4 },
    { id: 'mid-good', cost: 2, value: 0.7 },
    { id: 'pricey-best', cost: 4, value: 0.9 },
    { id: 'pricey-poor', cost: 4, value: 0.5 },
    { id: 'mid-worse', cost: 2.5, value: 0.6 },
  ];

  it('keeps each point nothing else beats on both cost and outcome', () => {
    expect([...paretoFrontier(points, true)].sort()).toEqual([
      'cheap-poor',
      'mid-good',
      'pricey-best',
    ]);
  });

  it('turns around where a lower outcome is better', () => {
    expect([...paretoFrontier(points, false)].sort()).toEqual(['cheap-poor']);
  });

  it('keeps both of two points that tie', () => {
    expect(
      [
        ...paretoFrontier(
          [
            { id: 'one', cost: 1, value: 0.5 },
            { id: 'other', cost: 1, value: 0.5 },
          ],
          true,
        ),
      ].sort(),
    ).toEqual(['one', 'other']);
  });
});
