import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { pinnedRunner } from '@work/application/services/pinned-runner';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { describe, expect, it, vi } from 'vitest';

const RUNNER = RunnerId.of('runner_1');
const KEY = ContinuityKey.of('task_1-station_1');

const answering = (...terms: string[]) => {
  const termsOf = vi.fn(async () => RunnerTerms.of(terms));

  return { termsOf, runners: { termsOf } as unknown as RunnerPresencePort };
};

describe('pinnedRunner', () => {
  it('asks what the pinned runner answers to, and keeps the pin while the placement admits it', async () => {
    const { termsOf, runners } = answering('pod-a', 'gpu');

    await expect(
      pinnedRunner(
        Continuity.of({ key: KEY, pinnedTo: RUNNER }),
        RunnerPlacement.of(['gpu']),
        runners,
      ),
    ).resolves.toBe(RUNNER);
    expect(termsOf).toHaveBeenCalledWith(RUNNER);
  });

  it('drops the pin when the placement forbids the pinned runner', async () => {
    await expect(
      pinnedRunner(
        Continuity.of({ key: KEY, pinnedTo: RUNNER }),
        RunnerPlacement.of(['gpu']),
        answering('laptop').runners,
      ),
    ).resolves.toBeNull();
  });

  it('asks nothing of the fleet for an unpinned run', async () => {
    const { termsOf, runners } = answering();

    await expect(
      pinnedRunner(
        Continuity.of({ key: KEY }),
        RunnerPlacement.of(['gpu']),
        runners,
      ),
    ).resolves.toBeNull();
    expect(termsOf).not.toHaveBeenCalled();
  });
});
