import type { ExclusiveClaimLocksPort } from '@runs/application/ports/exclusive-claim-locks.port';
import { RunClaims } from '@runs/application/services/run-claims.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import {
  orderedFor,
  workingCopyKeyOf,
} from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-14T12:00:00.000Z');

const queued = (task: string, harness = 'claude-code') =>
  Run.enqueue({
    id: RunId.of(`run_of_${task}`),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of(harness),
    ...orderedFor.holdingTurn(task, 0),
    now: NOW,
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'carry on with the task',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  });

const avoiding = (keys: readonly WorkingCopyKey[]): Claimant => ({
  runner: RunnerId.of('pooled_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harnesses: [HarnessId.of('claude-code')],
  offer: RunnerOffer.of(['linux']),
  claims: 'any',
  source: null,
  sandbox: { avoiding: keys },
});

const claimsOver = (waiting: readonly Run[]) => {
  const waits = {
    note: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
  const logger = { warn: vi.fn() };
  const runs = {
    claimCandidates: vi.fn(() =>
      Promise.resolve({ waiting, leasedRequesters: [] }),
    ),
    save: vi.fn(async () => {}),
    leasedAmong: vi.fn(() => Promise.resolve([])),
  };
  const claims = new RunClaims(
    partial<RunRepository>(runs),
    partial<TelemetryPort>({ measure: vi.fn() }),
    { linkActiveSpanTo: vi.fn() },
    partial<ExclusiveClaimLocksPort>({
      claimingFor: <T>(_requester: unknown, claim: () => Promise<T>) => claim(),
    }),
    partial<WorkingCopyArchiveRepository>({
      completedKeysAmong: vi.fn(() => Promise.resolve([])),
    }),
    waits,
    partial<LoggerPort>(logger),
  );

  return { claims, runs, waits, logger };
};

describe('RunClaims', () => {
  it('forgets why a run waited once it claims the run', async () => {
    const { claims, waits } = claimsOver([queued('task_1')]);

    const claimed = await claims.next(avoiding([]), NOW);

    expect(claimed).not.toBeNull();
    expect(waits.clear).toHaveBeenCalledExactlyOnceWith(claimed?.id);
  });

  it('keeps the claim when forgetting the wait fails, and says so', async () => {
    const { claims, waits, logger } = claimsOver([queued('task_1')]);
    waits.clear.mockRejectedValue(new Error('database went away'));

    await expect(claims.next(avoiding([]), NOW)).resolves.not.toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('sees a queued run the claimant would take, and claims nothing', async () => {
    const { claims, runs } = claimsOver([queued('task_1')]);

    expect(await claims.waitsFor(avoiding([]), NOW)).toBe(true);
    expect(runs.save).not.toHaveBeenCalled();
  });

  it('sees no waiting run when every queued run is avoided or needs another harness', async () => {
    const avoided = queued('task_1');
    const { claims } = claimsOver([avoided, queued('task_2', 'codex')]);

    expect(
      await claims.waitsFor(avoiding([workingCopyKeyOf(avoided)]), NOW),
    ).toBe(false);
  });
});
