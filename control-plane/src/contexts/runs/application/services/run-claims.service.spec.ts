import { RunClaims } from '@runs/application/services/run-claims.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
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
  sandbox: { avoiding: keys },
});

const claimsOver = (waiting: readonly Run[]) => {
  const runs = {
    claimCandidates: vi.fn(async () => ({ waiting, leasedRequesters: [] })),
    save: vi.fn(async () => {}),
  };
  const claims = new RunClaims(
    runs as unknown as RunRepository,
    { measure: vi.fn() } as unknown as TelemetryPort,
    { linkActiveSpanTo: vi.fn() },
    { claimingFor: vi.fn() },
    {
      completedKeysAmong: vi.fn(async () => []),
    } as unknown as WorkingCopyArchiveRepository,
  );

  return { claims, runs };
};

describe('RunClaims', () => {
  it('sees a queued run the claimant would take, and claims nothing', async () => {
    const { claims, runs } = claimsOver([queued('task_1')]);

    expect(await claims.waitsFor(avoiding([]), NOW)).toBe(true);
    expect(runs.save).not.toHaveBeenCalled();
  });

  it('sees no waiting run when every queued run is avoided or needs another harness', async () => {
    const avoided = queued('task_1');
    const { claims } = claimsOver([avoided, queued('task_2', 'codex')]);

    expect(
      await claims.waitsFor(
        avoiding([avoided.workingCopyKey as WorkingCopyKey]),
        NOW,
      ),
    ).toBe(false);
  });
});
