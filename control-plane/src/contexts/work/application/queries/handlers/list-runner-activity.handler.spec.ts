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
    {
      runnerId: 'runner_1',
      runId: 'run_7',
      state: 'claimed',
      kind: 'task' as const,
      teamId: 'team_read',
      title: 'Drain the stuck retry queues',
    },
    {
      runnerId: 'runner_2',
      runId: 'run_8',
      state: 'running',
      kind: 'chat' as const,
      teamId: 'team_other',
      title: 'Plan the billing migration',
    },
    {
      runnerId: 'runner_3',
      runId: 'run_9',
      state: 'running',
      kind: 'search' as const,
      teamId: null,
      title: null,
    },
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
      clearanceAsTeamReader: vi.fn(async (teamId: string) =>
        teamId === 'team_read' ? { workspaceId: WORKSPACE, teamId } : null,
      ),
    } as unknown as WorkspaceAccessPort,
    { heldIn } as RunnerActivityReaderPort,
  );

  return { handler, heldIn };
};

describe('ListRunnerActivityHandler', () => {
  it('says which run each busy runner of the workspace is working on, naming it only for the teams the viewer reads', async () => {
    const { handler, heldIn } = listing(true);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toEqual([
      {
        runnerId: 'runner_1',
        currentRun: {
          id: 'run_7',
          state: 'claimed',
          kind: 'task',
          teamId: 'team_read',
          readable: true,
          title: 'Drain the stuck retry queues',
        },
      },
      {
        runnerId: 'runner_2',
        currentRun: {
          id: 'run_8',
          state: 'running',
          kind: 'chat',
          teamId: 'team_other',
          readable: false,
          title: null,
        },
      },
      {
        runnerId: 'runner_3',
        currentRun: {
          id: 'run_9',
          state: 'running',
          kind: 'search',
          teamId: null,
          readable: false,
          title: null,
        },
      },
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
