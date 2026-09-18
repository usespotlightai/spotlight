import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunnerActivityReaderPort } from '@work/application/ports/runner-activity-reader.port';
import { ListRunnerActivityHandler } from '@work/application/queries/handlers/list-runner-activity.handler';
import { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const listing = (member: boolean) => {
  const heldIn = vi.fn(async () => [
    { runnerId: 'runner_1', runId: 'run_7', state: 'claimed' },
  ]);

  const handler = new ListRunnerActivityHandler(
    {
      inWorkspace: vi.fn(async () =>
        member
          ? {
              workspaceId: WORKSPACE,
              slug: 'acme',
              viewer: UserId.of('user_1'),
              administers: false,
            }
          : null,
      ),
    } as unknown as WorkspaceAccessPort,
    { heldIn } as RunnerActivityReaderPort,
  );

  return { handler, heldIn };
};

describe('ListRunnerActivityHandler', () => {
  it('says which run each busy runner of the workspace is working on', async () => {
    const { handler, heldIn } = listing(true);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toEqual([
      { runnerId: 'runner_1', currentRun: { id: 'run_7', state: 'claimed' } },
    ]);
    expect(heldIn).toHaveBeenCalledWith(WORKSPACE);
  });

  it('shows nothing to someone outside the workspace', async () => {
    const { handler, heldIn } = listing(false);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toBeNull();
    expect(heldIn).not.toHaveBeenCalled();
  });
});
