import { Citation } from '@insights/domain/value-objects/citation.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { describe, expect, it } from 'vitest';

const hunkOf = (id: string, lines: readonly string[]) => ({
  id,
  path: 'api/src/uploads.ts',
  header: '@@ -1 +1 @@',
  lines,
});

describe('SeenEvidence', () => {
  it('keeps each step and hunk once, however often it is given', () => {
    const step = { index: 4, kind: 'message', tool: null, text: 'Retrying.' };
    const seen = SeenEvidence.of({
      steps: [step, step],
      hunks: [hunkOf('a#1', ['+a']), hunkOf('a#1', ['+a'])],
    });

    expect(seen.steps).toHaveLength(1);
    expect(seen.hunks).toHaveLength(1);
  });

  it('clips what it keeps of each step and hunk', () => {
    const seen = SeenEvidence.of({
      steps: [
        {
          index: 1,
          kind: 'k'.repeat(500),
          tool: 't'.repeat(500),
          text: 'x'.repeat(10_000),
        },
      ],
      hunks: [
        {
          id: 'a#1',
          path: 'p'.repeat(2_000),
          header: 'h'.repeat(2_000),
          lines: Array.from({ length: 80 }, () => `+${'y'.repeat(2_000)}`),
        },
      ],
    });

    const [step] = seen.steps;
    const [hunk] = seen.hunks;
    expect(step?.kind.length).toBeLessThanOrEqual(102);
    expect(step?.tool?.length).toBeLessThanOrEqual(102);
    expect(step?.text.length).toBeLessThanOrEqual(2_002);
    expect(hunk?.path.length).toBeLessThanOrEqual(502);
    expect(hunk?.header.length).toBeLessThanOrEqual(202);
    expect(hunk?.lines).toHaveLength(20);
    expect(hunk?.lines[0]?.length).toBeLessThanOrEqual(202);
  });

  it('clips the same way however often it is read back', () => {
    const once = SeenEvidence.of({
      steps: [
        { index: 1, kind: 'message', tool: null, text: 'x'.repeat(5_000) },
      ],
      hunks: [],
    });

    expect(SeenEvidence.of(once)).toEqual(once);
  });

  it('keeps within a budget, going on past what does not fit', () => {
    const seen = SeenEvidence.of({
      steps: [
        { index: 1, kind: 'message', tool: null, text: 'x'.repeat(2_000) },
        { index: 2, kind: 'message', tool: null, text: 'short' },
      ],
      hunks: [],
    }).within(1_000);

    expect(seen.steps.map((each) => each.index)).toEqual([2]);
    expect(seen.size).toBeLessThanOrEqual(1_000);
  });

  it('keeps only what the given citations cite', () => {
    const seen = SeenEvidence.of({
      steps: [
        { index: 1, kind: 'message', tool: null, text: 'one' },
        { index: 2, kind: 'message', tool: null, text: 'two' },
      ],
      hunks: [hunkOf('a#1', ['+a']), hunkOf('a#2', ['+b'])],
    });
    const citations = [Citation.ofStep(2), Citation.ofHunk('a#1')];

    const cited = seen.citedBy(citations);

    expect(cited.steps.map((each) => each.index)).toEqual([2]);
    expect(cited.hunks.map((each) => each.id)).toEqual(['a#1']);
    expect(cited.onlyCitedBy(citations)).toBe(true);
    expect(seen.onlyCitedBy(citations)).toBe(false);
    expect(cited.stepAt(2)?.text).toBe('two');
    expect(cited.hunkOf('a#2')).toBeNull();
  });
});
