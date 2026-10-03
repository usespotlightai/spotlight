import {
  aSet,
  candidateOf,
  replayedAs,
  replayFor,
} from '@replays/domain/replays.fake-spec';
import {
  DEFAULT_MIN_GAIN,
  gainBetween,
  gainReadingOf,
} from '@replays/domain/services/gain-reading';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const paired = (candidate: readonly number[], baseline: readonly number[]) =>
  candidate.map((each, at) => ({
    candidate: each,
    baseline: baseline[at] as number,
  }));

describe('gainReadingOf', () => {
  it('reads nothing without a task both sides scored', () => {
    expect(gainReadingOf([], DEFAULT_MIN_GAIN, 'seed')).toBeNull();
  });

  it('calls a gain better when its whole interval is above nothing and it reaches the min gain', () => {
    const read = gainReadingOf(
      paired(Array(20).fill(1), Array(20).fill(0)),
      DEFAULT_MIN_GAIN,
      'seed',
    );

    expect(read).toMatchObject({
      gain: 1,
      low: 1,
      high: 1,
      verdict: 'better',
      minGain: DEFAULT_MIN_GAIN,
      tasks: 20,
    });
  });

  it('calls a loss worse when its whole interval is below nothing and it reaches the min gain', () => {
    expect(
      gainReadingOf(
        paired(Array(10).fill(0), Array(10).fill(1)),
        DEFAULT_MIN_GAIN,
        'seed',
      )?.verdict,
    ).toBe('worse');
  });

  it('calls any gain within noise on fewer than five paired tasks', () => {
    expect(
      gainReadingOf(
        paired([1, 1, 1, 1], [0, 0, 0, 0]),
        DEFAULT_MIN_GAIN,
        'seed',
      ),
    ).toMatchObject({ gain: 1, tasks: 4, verdict: 'within-noise' });
    expect(
      gainReadingOf(
        paired([1, 1, 1, 1, 1], [0, 0, 0, 0, 0]),
        DEFAULT_MIN_GAIN,
        'seed',
      )?.verdict,
    ).toBe('better');
  });

  it('calls a gain within noise when its interval reaches below nothing', () => {
    const read = gainReadingOf(
      paired([1, 0, 1, 0, 1, 1, 0, 0], [0, 1, 0, 1, 1, 0, 0, 0]),
      DEFAULT_MIN_GAIN,
      'seed',
    );

    expect(read?.gain).toBeCloseTo(0.125);
    expect(read?.low).toBeLessThan(0);
    expect(read?.verdict).toBe('within-noise');
  });

  it('calls a sure gain smaller than the min gain within noise', () => {
    const read = gainReadingOf(
      paired(Array(10).fill(0.53), Array(10).fill(0.5)),
      DEFAULT_MIN_GAIN,
      'seed',
    );

    expect(read?.low).toBeGreaterThan(0);
    expect(read?.verdict).toBe('within-noise');
    expect(
      gainReadingOf(
        paired(Array(10).fill(0.53), Array(10).fill(0.5)),
        0.02,
        'seed',
      )?.verdict,
    ).toBe('better');
  });
});

describe('gainBetween', () => {
  it('pairs the two replays task by task, over the tasks both scored, on per-task means', () => {
    const set = aSet(4);
    const candidate = replayedAs(
      replayFor(set, 'replay_candidate', 'candidate_proposed', null, false, 2),
      (original, repeat) =>
        original === 'original_0' && repeat === 2 ? 'failed' : 'completed',
    );
    const baseline = replayedAs(
      replayFor(set, 'replay_live', candidateOf('live').id.value, null, true),
      (original) => (original === 'original_3' ? 'completed' : 'failed'),
    );
    const read = gainBetween(candidate, baseline, DEFAULT_MIN_GAIN);

    expect(read?.tasks).toBe(4);
    expect(read?.gain).toBeCloseTo((0.5 + 1 + 1 + 0) / 4);
    expect(gainBetween(candidate, baseline, DEFAULT_MIN_GAIN)).toEqual(read);
    expect(
      gainBetween(candidate, baseline, DEFAULT_MIN_GAIN, [
        RunId.of('original_3'),
      ]),
    ).toMatchObject({ gain: 0, tasks: 1, verdict: 'within-noise' });
  });
});
