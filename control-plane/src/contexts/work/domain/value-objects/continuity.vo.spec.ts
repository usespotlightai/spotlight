import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { describe, expect, it } from 'vitest';

const RUNNER = RunnerId.of('runner_1');
const GPU = RunnerPlacement.of(['gpu']);

const pinned = (pinnedTo: RunnerId | null = RUNNER) =>
  Continuity.of({ key: ContinuityKey.of('task_1-station_1'), pinnedTo });

describe('Continuity, pinned within a placement', () => {
  it('stays with the runner it was pinned to when that runner may still run there', () => {
    expect(pinned().pinnedWithin(GPU, RunnerTerms.of(['pod-a', 'gpu']))).toBe(
      RUNNER,
    );
    expect(
      pinned().pinnedWithin(RunnerPlacement.anywhere(), RunnerTerms.none()),
    ).toBe(RUNNER);
  });

  it('lets go of a runner the placement no longer admits, so another can resume from the same workspace path', () => {
    expect(pinned().pinnedWithin(GPU, RunnerTerms.of(['laptop']))).toBeNull();
    expect(pinned().pinnedWithin(GPU, RunnerTerms.none())).toBeNull();
  });

  it('lets go of a pinned runner holding another release of the harness the station pins', () => {
    const release = RunnerPlacement.of(['claude-code@2.1.270']);

    expect(
      pinned().pinnedWithin(
        release,
        RunnerTerms.of(['runner-1', 'claude-code@2.1.269']),
      ),
    ).toBeNull();
    expect(
      pinned().pinnedWithin(
        release,
        RunnerTerms.of(['runner-1', 'claude-code@2.1.270']),
      ),
    ).toBe(RUNNER);
  });

  it('pins nothing it was never pinned to', () => {
    expect(pinned(null).pinnedWithin(GPU, RunnerTerms.of(['gpu']))).toBeNull();
  });
});
