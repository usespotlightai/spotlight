import type { GainEstimate } from '@replays/domain/services/gain-estimate';
import {
  DEFAULT_MIN_GAIN,
  MIN_PAIRED_TASKS,
} from '@replays/domain/services/gain-estimate';
import { overfitOf } from '@replays/domain/services/overfit';
import { describe, expect, it } from 'vitest';

const estimate = (
  significance: GainEstimate['significance'],
  tasks = 10,
): GainEstimate => ({
  gain: significance === 'better' ? 0.2 : significance === 'worse' ? -0.2 : 0,
  low: significance === 'better' ? 0.1 : -0.1,
  high: significance === 'worse' ? -0.1 : 0.3,
  significance,
  minGain: DEFAULT_MIN_GAIN,
  tasks,
});

describe('overfitOf', () => {
  it('marks a candidate better on the searched tasks but within noise on the held out ones', () => {
    expect(overfitOf(estimate('better'), estimate('within-noise'))).toBe(
      'likely',
    );
  });

  it('marks a candidate better on the searched tasks but worse on the held out ones', () => {
    expect(overfitOf(estimate('better'), estimate('worse'))).toBe('likely');
  });

  it('marks a candidate whose held out estimate pairs exactly the fewest tasks it trusts', () => {
    expect(
      overfitOf(estimate('better'), estimate('within-noise', MIN_PAIRED_TASKS)),
    ).toBe('likely');
  });

  it('does not mark a candidate when too few held out tasks paired to tell', () => {
    expect(
      overfitOf(
        estimate('better'),
        estimate('within-noise', MIN_PAIRED_TASKS - 1),
      ),
    ).toBe('too-few-held-out');
    expect(overfitOf(estimate('better'), estimate('within-noise', 1))).toBe(
      'too-few-held-out',
    );
  });

  it('leaves a candidate better on both sides unmarked', () => {
    expect(overfitOf(estimate('better'), estimate('better'))).toBeNull();
  });

  it('leaves a candidate unmarked until its held out tasks are scored', () => {
    expect(overfitOf(estimate('better'), null)).toBeNull();
  });

  it('leaves a candidate unmarked when it was not better on the searched tasks', () => {
    expect(overfitOf(estimate('within-noise'), estimate('worse'))).toBeNull();
    expect(
      overfitOf(estimate('within-noise'), estimate('within-noise', 1)),
    ).toBeNull();
    expect(overfitOf(null, estimate('within-noise'))).toBeNull();
  });
});
