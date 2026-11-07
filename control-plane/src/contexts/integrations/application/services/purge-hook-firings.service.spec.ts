import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import {
  clock,
  firingsInMemory,
  NOW,
  stateOf,
} from '@integrations/application/services/hook-firings.fake-spec';
import { PurgeHookFirings } from '@integrations/application/services/purge-hook-firings.service';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const FINISHED = HookFiring.rehydrate({
  ...stateOf(
    HookFiring.fire({
      id: HookFiringId.of('firing_1'),
      hookId: HookDefinitionId.of('audit_id'),
      workspaceId: WorkspaceId.of('workspace_1'),
      teamId: TeamId.of('team_1'),
      taskId: TaskId.of('task_1'),
      runId: RunId.of('run_1'),
      stationKey: StationKey.of('implementation'),
      on: 'task.moved',
      occurrence: 'moved_1',
      firedAt: NOW,
      event: {},
      matched: true,
      cause: CausalChain.none(),
      link: {
        kind: 'hook',
        key: 'hook:audit_id',
        description: 'the hook audit',
      },
    }),
  ),
  progress: { kind: 'done', at: new Date(NOW.getTime() - 31 * 86_400_000) },
  version: 1,
});

const setUp = () => {
  const inMemory = firingsInMemory(FINISHED);
  const purgeExpired = vi.fn(async () => 2);

  vi.mocked(inMemory.firings.finishedBefore).mockResolvedValue([FINISHED]);

  return {
    ...inMemory,
    purgeExpired,
    purging: new PurgeHookFirings(
      inMemory.firings,
      { purgeExpired } as unknown as HookCallbackTokens,
      clock,
    ),
  };
};

describe('PurgeHookFirings', () => {
  it('purges each firing that finished a month ago', async () => {
    const { purging, firings, saved } = setUp();

    await expect(purging.purge()).resolves.toBe(1);

    expect(firings.finishedBefore).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 30 * 86_400_000),
      500,
    );
    expect(saved[0]?.isDiscarded).toBe(true);
  });

  it('purges the expired callback tokens too', async () => {
    const { purging, purgeExpired } = setUp();

    await purging.purge();

    expect(purgeExpired).toHaveBeenCalledOnce();
  });

  it('leaves a firing another purge removed first', async () => {
    const { purging, firings } = setUp();
    vi.mocked(firings.save).mockRejectedValueOnce(
      new HookFiringVersionConflictError('firing_1'),
    );

    await expect(purging.purge()).resolves.toBe(1);
  });
});
