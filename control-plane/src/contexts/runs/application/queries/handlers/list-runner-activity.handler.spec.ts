import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunPolicyContract } from '@runs/application/contracts/run-order.contract';
import type {
  RunnerActivityRow,
  WorkingCopyRunRow,
} from '@runs/application/ports/runner-activity-reader.port';
import { ListRunnerActivityHandler } from '@runs/application/queries/handlers/list-runner-activity.handler';
import { ListRunnerActivityQuery } from '@runs/application/queries/list-runner-activity.query';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunTitles } from '@runs/application/services/run-titles.service';
import type { RunViewing } from '@runs/application/services/run-viewing.service';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
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
): RunnerActivityRow => ({
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

const { runnerId: _, ...lastTaskRun } = leasedRun(
  'run_6',
  { owner: 'work', kind: 'task', id: 'task_1' },
  'team_1',
);

const LAST_RUNS: WorkingCopyRunRow[] = [
  { ...lastTaskRun, state: 'completed', workingCopyKey: 'work/task-task_1' },
];

const listing = (member: boolean) => {
  const leasedIn = vi.fn(async () => LEASED);
  const lastRunsOf = vi.fn(async () => LAST_RUNS);
  const idleIn = vi.fn(async () => ['work/task-task_1']);
  const labels = new RunRequesterLabels();
  labels.register({
    owner: 'work',
    labelsOf: async () =>
      new Map([
        [
          'work/task/task_1',
          {
            title: 'Drain the stuck retry queues',
            readers: { of: 'the-run', opens: true, hidden: 'Hidden task' },
          },
        ],
        [
          'work/chat/chat_1',
          {
            title: 'Plan the billing migration',
            readers: { of: 'the-run', opens: false, hidden: 'Hidden chat' },
          },
        ],
      ]),
  });
  const viewers = partial<RunViewing>({
    readableAmong: vi.fn(async () => new Set(['run_6', 'run_7'])),
  });

  const access = partial<WorkspaceAccessPort>({
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
  });

  const handler = new ListRunnerActivityHandler(
    access,
    { leasedIn, lastRunsOf, runsOf: vi.fn(async () => []) },
    { idleIn },
    new RunTitles(
      labels,
      viewers,
      { leasedIn, lastRunsOf, runsOf: vi.fn(async () => []) },
      access,
    ),
  );

  return { handler, leasedIn, lastRunsOf, idleIn, viewers };
};

describe('ListRunnerActivityHandler', () => {
  it('says which run each busy runner works on, by the kind its requester names, and titles only the runs the viewer may read', async () => {
    const { handler, leasedIn, viewers } = listing(true);

    const activity = await handler.execute(
      new ListRunnerActivityQuery('acme', 'user_1'),
    );

    expect(activity?.runners).toEqual([
      {
        runnerId: 'runner_of_run_7',
        currentRun: {
          id: 'run_7',
          state: 'claimed',
          kind: 'task',
          teamId: 'team_1',
          title: 'Drain the stuck retry queues',
          hidden: null,
          opens: { runId: 'run_7', teamId: 'team_1' },
        },
      },
      {
        runnerId: 'runner_of_run_8',
        currentRun: {
          id: 'run_8',
          state: 'claimed',
          kind: 'chat',
          teamId: 'team_1',
          title: null,
          hidden: 'Hidden chat',
          opens: null,
        },
      },
      {
        runnerId: 'runner_of_run_9',
        currentRun: {
          id: 'run_9',
          state: 'claimed',
          kind: 'search',
          teamId: 'team_1',
          title: 'A run',
          hidden: null,
          opens: null,
        },
      },
    ]);
    expect(leasedIn).toHaveBeenCalledWith(WORKSPACE);
    expect(viewers.readableAmong).toHaveBeenCalledWith(
      [...LEASED.slice(0, 2), ...LAST_RUNS],
      UserId.of('user_1'),
    );
  });

  it('names the last run of each working copy that an idle sandbox keeps', async () => {
    const { handler, lastRunsOf, idleIn } = listing(true);

    const activity = await handler.execute(
      new ListRunnerActivityQuery('acme', 'user_1'),
    );

    expect(activity?.workingCopies).toEqual([
      {
        workingCopyKey: 'work/task-task_1',
        lastRun: {
          id: 'run_6',
          state: 'completed',
          kind: 'task',
          teamId: 'team_1',
          title: 'Drain the stuck retry queues',
          hidden: null,
          opens: { runId: 'run_6', teamId: 'team_1' },
        },
      },
    ]);
    expect(idleIn).toHaveBeenCalledWith(WORKSPACE);
    expect(lastRunsOf).toHaveBeenCalledWith(WORKSPACE, ['work/task-task_1']);
  });

  it('shows nothing to a viewer outside the workspace', async () => {
    const { handler, leasedIn } = listing(false);

    await expect(
      handler.execute(new ListRunnerActivityQuery('acme', 'user_1')),
    ).resolves.toBeNull();
    expect(leasedIn).not.toHaveBeenCalled();
  });
});
