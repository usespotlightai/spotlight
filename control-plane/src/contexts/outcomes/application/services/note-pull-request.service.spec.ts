import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import { pendingReviewsInMemory } from '@outcomes/application/ports/pending-reviews.fake-spec';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  ChatRecordsInMemory,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  JudgingsInMemory,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const AT = new Date('2026-09-30T12:00:00.000Z');
const OPENED = new Date('2026-09-30T11:00:00.000Z');
const CLOCK = { now: () => AT, sleep: async () => {} };
const DAY_MS = 24 * 60 * 60 * 1000;

const delivering = () => {
  const deliveries = new TaskDeliveriesInMemory();

  return {
    deliveries,
    opened: (pullRequest = PULL) =>
      new NotePullRequestOpened(
        deliveries,
        pendingReviewsInMemory(),
        forgottenInMemory(),
        inTransaction,
        CLOCK,
      ).opened({
        taskId: TASK,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: OPENED,
      }),
    closed: (merged: boolean, workspaceId = WORKSPACE) =>
      new NotePullRequestClosed(deliveries, inTransaction).closed({
        workspaceId,
        pullRequest: PULL,
        merged,
        at: AT,
      }),
    state: async () => (await deliveries.forTask(TASK))?.state ?? null,
  };
};

describe('noting a task’s pull request', () => {
  it('holds it open once the task opens it', async () => {
    const noted = delivering();

    await noted.opened();

    expect(await noted.state()).toBe('open');
  });

  it('holds it merged once it merges', async () => {
    const noted = delivering();
    await noted.opened();

    await noted.closed(true);

    expect(await noted.state()).toBe('merged');
    expect((await noted.deliveries.forTask(TASK))?.closedAt).toEqual(AT);
  });

  it('changes nothing when the same pull request is opened again', async () => {
    const noted = delivering();
    await noted.opened();
    await noted.closed(true);

    await noted.opened();

    expect(await noted.state()).toBe('merged');
  });

  it('ignores a pull request no task opened, or one in another workspace', async () => {
    const noted = delivering();
    await noted.closed(true);
    await noted.opened();

    await noted.closed(true, WorkspaceId.of('ws_2'));

    expect(await noted.state()).toBe('open');
  });
});

const touches = new TaskTouchesInMemory();

const heldFor = () => ({
  records: new RunRecordsInMemory(),
  deliveries: new TaskDeliveriesInMemory(),
  judgings: new JudgingsInMemory(),
  scores: new ScoresInMemory(),
  touches: new TaskTouchesInMemory(),
  failures: new TaskFailuresInMemory(),
  chats: new ChatRecordsInMemory(),
  reviews: pendingReviewsInMemory(),
  forgotten: forgottenInMemory(),
});

const reviewing = (held: ReturnType<typeof heldFor>) =>
  new NotePullRequestReviewed(
    held.deliveries,
    held.reviews,
    held.forgotten,
    inTransaction,
    CLOCK,
  );

const opening = (held: ReturnType<typeof heldFor>) =>
  new NotePullRequestOpened(
    held.deliveries,
    held.reviews,
    held.forgotten,
    inTransaction,
    CLOCK,
  );

const OPENING = {
  taskId: TASK,
  workspaceId: WORKSPACE,
  teamId: TEAM,
  pullRequest: PULL,
  at: OPENED,
};

describe('holding a review heard before its task’s pull request', () => {
  it('holds a person’s review until the pull request’s task is heard of, then dates the first review by it', async () => {
    const held = heldFor();
    const reviewedAt = new Date(OPENED.getTime() + 60_000);

    await reviewing(held).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: reviewedAt,
    });
    await opening(held).opened(OPENING);

    expect((await held.deliveries.forTask(TASK))?.firstReviewAt).toEqual(
      reviewedAt,
    );
    expect(held.reviews.held.size).toBe(0);
  });

  it('holds no review by a bot, nor one that says no time', async () => {
    const held = heldFor();

    await reviewing(held).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: true,
      at: AT,
    });
    await reviewing(held).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: null,
    });

    expect(held.reviews.held.size).toBe(0);
  });

  it('holds no review older than insights ever look back, and lets go of those held that long', async () => {
    const held = heldFor();
    const longAgo = new Date(AT.getTime() - 200 * DAY_MS);
    const other = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await held.reviews.hold(WORKSPACE, { pullRequest: other, at: longAgo });

    await reviewing(held).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: longAgo,
    });

    expect(held.reviews.held.size).toBe(0);
  });

  it('dates no first review by a held review older than insights ever look back', async () => {
    const held = heldFor();
    await held.reviews.hold(WORKSPACE, {
      pullRequest: PULL,
      at: new Date(AT.getTime() - 200 * DAY_MS),
    });

    await opening(held).opened(OPENING);

    expect((await held.deliveries.forTask(TASK))?.firstReviewAt).toBeNull();
    expect(held.reviews.held.size).toBe(0);
  });

  it('lets go of the reviews held for a deleted task’s pull request', async () => {
    const held = heldFor();
    await opening(held).opened(OPENING);
    await held.reviews.hold(WORKSPACE, { pullRequest: PULL, at: AT });

    await new ForgetOutcomes(held, inTransaction).deliveryOfTask(
      WORKSPACE,
      TASK,
    );

    expect(held.reviews.held.size).toBe(0);
  });

  it('lets go of the reviews held for a disbanded team’s pull requests', async () => {
    const held = heldFor();
    await opening(held).opened(OPENING);
    await held.reviews.hold(WORKSPACE, { pullRequest: PULL, at: AT });

    await new ForgetOutcomes(held, inTransaction).deliveriesOfTeam(
      WORKSPACE,
      TEAM,
    );

    expect(held.reviews.held.size).toBe(0);
    expect(held.deliveries.held.size).toBe(0);
  });
});

describe('noting what a disbanded team did, however late it is heard of', () => {
  it('records no pull request, failure or review of a team once it is disbanded', async () => {
    const held = heldFor();
    await new ForgetOutcomes(held, inTransaction).runsOfTeam(WORKSPACE, TEAM);

    await opening(held).opened(OPENING);
    await new NoteTaskFailed(
      held.failures,
      held.forgotten,
      inTransaction,
    ).failed({
      taskId: TASK.value,
      workspaceId: WORKSPACE.value,
      teamId: TEAM.value,
      stationId: 'station_1',
      runId: null,
      source: 'run',
      code: 'exited',
      occurrences: 1,
      at: AT.toISOString(),
    });

    expect(held.deliveries.held.size).toBe(0);
    expect(held.failures.held.size).toBe(0);
  });

  it('holds the task and its team before it checks whether they were forgotten', async () => {
    const held = heldFor();

    await opening(held).opened(OPENING);

    expect(held.forgotten.holds).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
    ]);
  });
});

describe('forgetting outcomes', () => {
  it('forgets a deleted task’s runs and its delivery', async () => {
    const records = new RunRecordsInMemory();
    const noted = delivering();
    await records.add(endedRecord('run_1'));
    await records.add(endedRecord('run_2', { taskId: 'task_2' }));
    await noted.opened();
    const forgetting = new ForgetOutcomes(
      {
        records,
        deliveries: noted.deliveries,
        judgings: new JudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        reviews: pendingReviewsInMemory(),
        forgotten: forgottenInMemory(),
      },
      inTransaction,
    );

    await forgetting.runsOfTask(WORKSPACE, TASK);
    await forgetting.deliveryOfTask(WORKSPACE, TASK);

    expect(await records.of(RunId.of('run_1'))).toBeNull();
    expect(await records.of(RunId.of('run_2'))).not.toBeNull();
    expect(await noted.state()).toBeNull();
  });

  it('forgets what it heard of a deleted task’s runs before they ended', async () => {
    const records = new RunRecordsInMemory();
    await records.add(
      RunRecord.heardOf(RunId.of('run_1'), WORKSPACE, TASK).checked('passed'),
    );

    await new ForgetOutcomes(
      {
        records,
        deliveries: new TaskDeliveriesInMemory(),
        judgings: new JudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        reviews: pendingReviewsInMemory(),
        forgotten: forgottenInMemory(),
      },
      inTransaction,
    ).runsOfTask(WORKSPACE, TASK);

    expect(records.held.size).toBe(0);
  });

  it('forgets everything of a closed workspace', async () => {
    const records = new RunRecordsInMemory();
    const noted = delivering();
    await records.add(endedRecord('run_1'));
    await noted.opened();
    const forgetting = new ForgetOutcomes(
      {
        records,
        deliveries: noted.deliveries,
        judgings: new JudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        reviews: pendingReviewsInMemory(),
        forgotten: forgottenInMemory(),
      },
      inTransaction,
    );

    await forgetting.runsOfWorkspace(WORKSPACE);
    await forgetting.deliveriesOfWorkspace(WORKSPACE);

    expect(records.held.size).toBe(0);
    expect(noted.deliveries.held.size).toBe(0);
  });
});
