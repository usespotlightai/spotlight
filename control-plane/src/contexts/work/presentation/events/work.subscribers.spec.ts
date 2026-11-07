import { RUN_SUSPENDED } from '@shared-kernel/application/integration-events/run-suspended.integration-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { requestedBy } from '@work/application/ports/runs.fake-spec';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { describe, expect, it, vi } from 'vitest';

describe('workSubscribers', () => {
  it('reconciles the setup list of the team whose setup chat opened its pull request', async () => {
    const forTeam = vi.fn(async () => undefined);
    const reconciling = workSubscribers({
      setup: { forTeam },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.reconcile-setup-on-pull-request',
    );

    await reconciling?.handle(
      new SetupPullRequestOpened(
        ChatId.of('chat_1'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        PullRequestUrl.of('https://github.com/acme/infra/pull/12'),
        new Date('2026-10-11T09:00:00.000Z'),
      ),
    );

    expect(reconciling?.kinds).toEqual(['chat.setup-pull-request-opened']);
    expect(forTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
  });

  it('takes up the run a person answered, whichever way the answer came', async () => {
    const answeredRuns = { on: vi.fn(async () => {}) };
    const taking = workSubscribers({
      answeredRuns,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.take-up-the-run-a-person-answered',
    );
    const answered = new TaskAnswered(
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      RunId.of('run_1'),
      null,
    );

    await taking?.handle(answered);

    expect(taking?.kinds).toEqual(['task.answered']);
    expect(taking?.callsOut).toBe(true);
    expect(answeredRuns.on).toHaveBeenCalledWith(answered);
  });

  it('decides the turn of a run that suspended, outside the transaction that suspended it', async () => {
    const turns = { take: vi.fn(async () => {}) };
    const taking = workSubscribers({
      turns,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.take-turn',
    );

    await taking?.handle({
      kind: RUN_SUSPENDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      requester: requestedBy.task('task_1', 0),
      attempt: 2,
      at: '2026-11-07T10:00:00.000Z',
    } as never);

    expect(taking?.kinds).toEqual(['runs.run-suspended.v1']);
    expect(taking?.callsOut).toBe(true);
    expect(turns.take).toHaveBeenCalledWith(RunId.of('run_1'), 2);
  });
});
