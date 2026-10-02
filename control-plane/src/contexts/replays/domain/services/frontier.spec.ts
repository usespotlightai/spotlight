import {
  type FrontierPoint,
  frontierOf,
} from '@replays/domain/services/frontier';
import { describe, expect, it } from 'vitest';

interface Named extends FrontierPoint {
  readonly id: string;
}

const point = (
  id: string,
  searchScore: number | null,
  costPerRun: number | null,
  more: Partial<Named> = {},
): Named => ({
  id,
  seed: false,
  finished: true,
  searchScore,
  costPerRun,
  ...more,
});

const ids = (points: readonly Named[]) => points.map((each) => each.id);

describe('frontierOf', () => {
  it('drops a candidate another beats on success without costing more, or on cost without succeeding less', () => {
    const points = [
      point('cheap', 0.5, 0.1),
      point('best', 0.9, 0.5),
      point('middle', 0.7, 0.3),
      point('dominated', 0.6, 0.4),
      point('worse-and-dearer', 0.4, 0.6),
    ];

    expect(ids(frontierOf(points))).toEqual(['cheap', 'middle', 'best']);
  });

  it('keeps candidates that tie exactly', () => {
    expect(
      ids(frontierOf([point('one', 0.8, 0.2), point('two', 0.8, 0.2)])),
    ).toEqual(['one', 'two']);
  });

  it('drops a candidate equal on one axis and worse on the other', () => {
    expect(
      ids(frontierOf([point('one', 0.8, 0.2), point('two', 0.8, 0.3)])),
    ).toEqual(['one']);
  });

  it('always keeps the seed, though another dominates it, and lets it dominate', () => {
    const points = [
      point('seed', 0.5, 0.5, { seed: true }),
      point('better', 0.9, 0.1),
      point('beaten-by-seed', 0.4, 0.6),
    ];

    expect(ids(frontierOf(points))).toEqual(['better', 'seed']);
  });

  it('leaves out candidates whose search replay did not finish, or that scored nothing', () => {
    const points = [
      point('seed', 0.5, 0.5, { seed: true, finished: false }),
      point('running', 1, 0.01, { finished: false }),
      point('unscored', null, 0.01),
      point('fine', 0.6, 0.6),
    ];

    expect(ids(frontierOf(points))).toEqual(['seed', 'fine']);
  });

  it('counts an unpriced candidate as the dearest', () => {
    expect(
      ids(frontierOf([point('priced', 0.8, 1), point('unpriced', 0.8, null)])),
    ).toEqual(['priced']);
    expect(
      ids(frontierOf([point('priced', 0.5, 1), point('unpriced', 0.9, null)])),
    ).toEqual(['priced', 'unpriced']);
  });
});
