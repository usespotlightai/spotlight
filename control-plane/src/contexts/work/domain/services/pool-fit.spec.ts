import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { poolCouldTake } from '@work/domain/services/pool-fit';
import { describe, expect, it } from 'vitest';

const labels = RunnerTerms.of(['linux', 'gpu']);

describe('poolCouldTake', () => {
  it('takes a run placed anywhere', () => {
    expect(poolCouldTake(RunnerPlacement.anywhere(), labels)).toBe(true);
  });

  it('takes a run placed on a label the pool carries', () => {
    expect(poolCouldTake(RunnerPlacement.of(['gpu']), labels)).toBe(true);
  });

  it('refuses a run placed on a label the pool does not carry', () => {
    expect(poolCouldTake(RunnerPlacement.of(['vpc-internal']), labels)).toBe(
      false,
    );
  });

  it('takes a run pinned to a harness release, which the runner it starts brings along', () => {
    expect(
      poolCouldTake(RunnerPlacement.of(['claude-code@2.1.0']), labels),
    ).toBe(true);
  });

  it('refuses a run unless every clause of its placement is met', () => {
    expect(
      poolCouldTake(
        RunnerPlacement.ofClauses([['gpu'], ['vpc-internal']]),
        labels,
      ),
    ).toBe(false);
    expect(
      poolCouldTake(
        RunnerPlacement.ofClauses([['gpu'], ['vpc-internal', 'linux']]),
        labels,
      ),
    ).toBe(true);
  });
});
