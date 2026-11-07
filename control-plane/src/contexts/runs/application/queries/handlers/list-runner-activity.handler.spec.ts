import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunPolicyContract } from '@runs/application/contracts/run-order.contract';
import type { RunViewersPort } from '@runs/application/ports/run-viewers.port';
import type {
  LeasedRun,
  RunnerActivityReaderPort,
} from '@runs/application/ports/runner-activity-reader.port';
import { ListRunnerActivityHandler } from '@runs/application/queries/handlers/list-runner-activity.handler';
import { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: true,
};

const leasedRun = (
  runId: string,
  requester: { owner: string; kind: string; id: string },
  teamId: string | null,
): LeasedRun => ({
  runnerId: `runner_of_${runId}`,
  runId: RunId.of(runId),
  workspaceId: WORKSPACE,
  state: 'claimed',
  requester: { ...requester, token: null, team: teamId },
  policy: POLICY,
  teamId,
});

const LEASED = [
  leasedRun('run_7', { owner: 'work', kind: 'task', id: 'task_1' }, 'team_1'),
  leasedRun('run_8', { owner: 'work', kind: 'chat', id: 'chat_1' }, 'team_1'),
  leasedRun(
    'run_9',
    { owner: 'replays', kind: 'search', id: 'search_1' },
    'team_1',
  ),
];

const listing = (member: boolean) => {
  const leasedIn = vi.fn(async () => LEASED);
  const labels = new RunRequesterLabels();
  labels.register({
    owner: 'work',
    labelsOf: async () =>
      new Map([
        ['work/task/task_1', { title: 'Drain the stuck retry queues' }],
        ['work/chat/chat_1', { title: 'Plan the billing migration' }],
      ]),
  });
  const viewers = {
    watchedBy: vi.fn(),
    readableAmong: vi.fn(async () => new Set(['run_7'])),
  } satisfies RunViewersPort;

  const handler = new ListRunnerActivityHandler(
    {
      inWorkspace: vi.fn(async () =>
        member
          ? {
              workspaceId: WORKSPACE,
              slug: 'acme',
              viewer: UserId.of('user_1'),
              isAdmin: false,
            }
          : null,
      ),
    } as unknown as WorkspaceAccessPort,
    { leasedIn } as RunnerActivityReaderPort,
    labels,
    viewers,
  );

  return { handler, leasedIn, viewers };
};

describe('ListRunnerActivityHandler', () => {
  it('says which run each busy runner works on, by the kind its requester names, and labels only the runs the viewer may read', async () => {
    const { handler, leasedIn, viewers } = listing(true);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toEqual([
      {
        runnerId: 'runner_of_run_7',
        currentRun: {
          id: 'run_7',
          state: 'claimed',
          kind: 'task',
          teamId: 'team_1',
          readable: true,
          title: 'Drain the stuck retry queues',
        },
      },
      {
        runnerId: 'runner_of_run_8',
        currentRun: {
          id: 'run_8',
          state: 'claimed',
          kind: 'chat',
          teamId: 'team_1',
          readable: false,
          title: null,
        },
      },
      {
        runnerId: 'runner_of_run_9',
        currentRun: {
          id: 'run_9',
          state: 'claimed',
          kind: 'search',
          teamId: 'team_1',
          readable: false,
          title: null,
        },
      },
    ]);
    expect(leasedIn).toHaveBeenCalledWith(WORKSPACE);
    expect(viewers.readableAmong).toHaveBeenCalledWith(
      LEASED,
      UserId.of('user_1'),
    );
  });

  it('shows nothing to a viewer outside the workspace', async () => {
    const { handler, leasedIn } = listing(false);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toBeNull();
    expect(leasedIn).not.toHaveBeenCalled();
  });
});
