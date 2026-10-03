import type { GainReading } from '@replays/domain/services/gain-reading';
import {
  DEFAULT_MIN_GAIN,
  FEWEST_PAIRED_TASKS,
} from '@replays/domain/services/gain-reading';
import { overfitOf } from '@replays/domain/services/overfit';
import { describe, expect, it } from 'vitest';

const reading = (verdict: GainReading['verdict'], tasks = 10): GainReading => ({
  gain: verdict === 'better' ? 0.2 : verdict === 'worse' ? -0.2 : 0,
  low: verdict === 'better' ? 0.1 : -0.1,
  high: verdict === 'worse' ? -0.1 : 0.3,
  verdict,
  minGain: DEFAULT_MIN_GAIN,
  tasks,
});

describe('overfitOf', () => {
  it('marks a candidate better on the searched tasks but within noise on the held out ones', () => {
    expect(overfitOf(reading('better'), reading('within-noise'))).toBe(
      'marked',
    );
  });

  it('marks a candidate better on the searched tasks but worse on the held out ones', () => {
    expect(overfitOf(reading('better'), reading('worse'))).toBe('marked');
  });

  it('marks a candidate whose held out reading pairs exactly the fewest tasks it trusts', () => {
    expect(
      overfitOf(
        reading('better'),
        reading('within-noise', FEWEST_PAIRED_TASKS),
      ),
    ).toBe('marked');
  });

  it('does not mark a candidate when too few held out tasks paired to tell', () => {
    expect(
      overfitOf(
        reading('better'),
        reading('within-noise', FEWEST_PAIRED_TASKS - 1),
      ),
    ).toBe('too-few-held-out');
    expect(overfitOf(reading('better'), reading('within-noise', 1))).toBe(
      'too-few-held-out',
    );
  });

  it('leaves a candidate better on both sides unmarked', () => {
    expect(overfitOf(reading('better'), reading('better'))).toBeNull();
  });

  it('leaves a candidate unmarked until its held out tasks are scored', () => {
    expect(overfitOf(reading('better'), null)).toBeNull();
  });

  it('leaves a candidate unmarked when it was not better on the searched tasks', () => {
    expect(overfitOf(reading('within-noise'), reading('worse'))).toBeNull();
    expect(
      overfitOf(reading('within-noise'), reading('within-noise', 1)),
    ).toBeNull();
    expect(overfitOf(null, reading('within-noise'))).toBeNull();
  });
});
