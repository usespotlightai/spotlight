import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { nearestLevels } from '@change-review/domain/services/nearest-levels';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const link = (kind: HunkLink['kind'], from: string, to: string): HunkLink => ({
  kind,
  from: HunkId.of(from),
  to: HunkId.of(to),
  because: ['invite'],
});

const levelsOf = (
  links: HunkLink[],
  layers: Record<string, number>,
  lines: Record<string, number>,
) =>
  Object.fromEntries(
    nearestLevels(
      links,
      new Map(Object.entries(layers)),
      (hunk) => lines[hunk] ?? 1,
    ),
  );

describe('nearestLevels', () => {
  it('keeps every hunk in its layer when no link is broken', () => {
    expect(
      levelsOf([link('uses', 'h2', 'h1')], { h1: 0, h2: 1, h3: 2 }, {}),
    ).toEqual({ h1: 0, h2: 1, h3: 2 });
  });

  it('moves the fewest lines that put a use after what it uses', () => {
    expect(
      levelsOf(
        [link('uses', 'h1', 'h3')],
        { h1: 0, h2: 1, h3: 2 },
        { h1: 10, h3: 200 },
      ),
    ).toEqual({ h2: 0, h3: 1, h1: 1 });
  });

  it('cuts a layer that the links join into parts of about the target size, in link order', () => {
    expect(
      levelsOf(
        [link('uses', 'h1', 'h2'), link('uses', 'h2', 'h1')],
        { h1: 0, h2: 1, h3: 1, h4: 1 },
        { h1: 300, h2: 50, h3: 300, h4: 300 },
      ),
    ).toEqual({ h1: 0, h2: 0, h3: 1, h4: 2 });
  });

  it('keeps moved code together', () => {
    expect(
      levelsOf([link('moves', 'h3', 'h1')], { h1: 0, h2: 1, h3: 2 }, {}),
    ).toEqual({ h1: 0, h3: 0, h2: 1 });
  });

  it('puts a test in the latest layer of the code it tests', () => {
    expect(
      levelsOf(
        [link('tests', 'h4', 'h1'), link('tests', 'h4', 'h2')],
        { h1: 0, h2: 1, h3: 2, h4: 3 },
        {},
      ),
    ).toEqual({ h1: 0, h2: 1, h4: 1, h3: 2 });
  });
});
