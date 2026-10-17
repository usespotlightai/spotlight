import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import { pendingReviewsInMemory } from '@outcomes/application/ports/pending-reviews.fake-spec';
import { stationConfigPullRequestsInMemory } from '@outcomes/application/ports/station-config-pull-requests.fake-spec';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import {
  ChatRecordsInMemory,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  ChangeJudgingsInMemory,
  JudgingsInMemory,
  PairJudgingsInMemory,
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
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
} from '@outcomes/domain/pull-requests.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

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
  it('records it open once the task opens it', async () => {
    const noted = delivering();

    await noted.opened();

    expect(await noted.state()).toBe('open');
  });

  it('records it merged once it merges', async () => {
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

const repositoriesInMemory = () => ({
  records: new RunRecordsInMemory(),
  deliveries: new TaskDeliveriesInMemory(),
  judgings: new JudgingsInMemory(),
  changeJudgings: new ChangeJudgingsInMemory(),
  pairJudgings: new PairJudgingsInMemory(),
  scores: new ScoresInMemory(),
  touches: new TaskTouchesInMemory(),
  failures: new TaskFailuresInMemory(),
  chats: new ChatRecordsInMemory(),
  pullRequests: new PullRequestRecordsInMemory(),
  shapes: new TaskChangeShapesInMemory(),
  watches: new StationWatchesInMemory(),
  reviews: pendingReviewsInMemory(),
  configPullRequests: stationConfigPullRequestsInMemory(),
  forgotten: forgottenInMemory(),
});

const reviewing = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new NotePullRequestReviewed(
    repositories.deliveries,
    repositories.reviews,
    repositories.forgotten,
    inTransaction,
    CLOCK,
  );

const opening = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new NotePullRequestOpened(
    repositories.deliveries,
    repositories.reviews,
    repositories.forgotten,
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

describe('keeping a review heard before its task’s pull request', () => {
  it('keeps a person’s review until the pull request’s task is heard of, then dates the first review by it', async () => {
    const repositories = repositoriesInMemory();
    const reviewedAt = new Date(OPENED.getTime() + 60_000);

    await reviewing(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: reviewedAt,
    });
    await opening(repositories).opened(OPENING);

    expect(
      (await repositories.deliveries.forTask(TASK))?.firstReviewAt,
    ).toEqual(reviewedAt);
    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('keeps no review by a bot, nor one that says no time', async () => {
    const repositories = repositoriesInMemory();

    await reviewing(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: true,
      at: AT,
    });
    await reviewing(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: null,
    });

    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('keeps no review older than insights ever look back, and lets go of those kept that long', async () => {
    const repositories = repositoriesInMemory();
    const longAgo = new Date(AT.getTime() - 200 * DAY_MS);
    const other = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await repositories.reviews.add(WORKSPACE, {
      pullRequest: other,
      at: longAgo,
    });

    await reviewing(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      byBot: false,
      at: longAgo,
    });

    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('dates no first review by a pending review older than insights ever look back', async () => {
    const repositories = repositoriesInMemory();
    await repositories.reviews.add(WORKSPACE, {
      pullRequest: PULL,
      at: new Date(AT.getTime() - 200 * DAY_MS),
    });

    await opening(repositories).opened(OPENING);

    expect(
      (await repositories.deliveries.forTask(TASK))?.firstReviewAt,
    ).toBeNull();
    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('lets go of the pending reviews of a deleted task’s pull request', async () => {
    const repositories = repositoriesInMemory();
    await opening(repositories).opened(OPENING);
    await repositories.reviews.add(WORKSPACE, { pullRequest: PULL, at: AT });

    await new ForgetOutcomes(repositories, inTransaction).deliveryOfTask(
      WORKSPACE,
      TASK,
    );

    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('lets go of the pending reviews of a disbanded team’s pull requests', async () => {
    const repositories = repositoriesInMemory();
    await opening(repositories).opened(OPENING);
    await repositories.reviews.add(WORKSPACE, { pullRequest: PULL, at: AT });

    await new ForgetOutcomes(repositories, inTransaction).deliveriesOfTeam(
      WORKSPACE,
      TEAM,
    );

    expect(repositories.reviews.stored.size).toBe(0);
    expect(repositories.deliveries.stored.size).toBe(0);
  });
});

describe('noting what a disbanded team did, however late it is heard of', () => {
  it('records no pull request, failure or review of a team once it is disbanded', async () => {
    const repositories = repositoriesInMemory();
    await new ForgetOutcomes(repositories, inTransaction).runsOfTeam(
      WORKSPACE,
      TEAM,
    );

    await opening(repositories).opened(OPENING);
    await new NoteTaskFailed(
      repositories.failures,
      repositories.forgotten,
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

    expect(repositories.deliveries.stored.size).toBe(0);
    expect(repositories.failures.stored.size).toBe(0);
  });

  it('locks the task and its team before it checks whether they were forgotten', async () => {
    const repositories = repositoriesInMemory();

    await opening(repositories).opened(OPENING);

    expect(repositories.forgotten.locks).toEqual([
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
        changeJudgings: new ChangeJudgingsInMemory(),
        pairJudgings: new PairJudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        watches: new StationWatchesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
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
      RunRecord.heardOf(RunId.of('run_1'), WORKSPACE, TASK).recordCheck(
        'passed',
        HEARD_AT,
      ),
    );

    await new ForgetOutcomes(
      {
        records,
        deliveries: new TaskDeliveriesInMemory(),
        judgings: new JudgingsInMemory(),
        changeJudgings: new ChangeJudgingsInMemory(),
        pairJudgings: new PairJudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        watches: new StationWatchesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
        forgotten: forgottenInMemory(),
      },
      inTransaction,
    ).runsOfTask(WORKSPACE, TASK);

    expect(records.stored.size).toBe(0);
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
        changeJudgings: new ChangeJudgingsInMemory(),
        pairJudgings: new PairJudgingsInMemory(),
        scores: new ScoresInMemory(),
        touches,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        watches: new StationWatchesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
        forgotten: forgottenInMemory(),
      },
      inTransaction,
    );

    await forgetting.runsOfWorkspace(WORKSPACE);
    await forgetting.deliveriesOfWorkspace(WORKSPACE);

    expect(records.stored.size).toBe(0);
    expect(noted.deliveries.stored.size).toBe(0);
  });
});
