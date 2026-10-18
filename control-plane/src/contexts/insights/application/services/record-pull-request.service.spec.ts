import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import { pendingReviewsInMemory } from '@insights/application/ports/pending-reviews.fake-spec';
import { stationConfigPullRequestsInMemory } from '@insights/application/ports/station-config-pull-requests.fake-spec';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { RecordPullRequestClosing } from '@insights/application/services/record-pull-request-closing.service';
import { RecordPullRequestOpening } from '@insights/application/services/record-pull-request-opening.service';
import { RecordPullRequestReview } from '@insights/application/services/record-pull-request-review.service';
import { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { StationAlertStatesInMemory } from '@insights/domain/alerts.fake-spec';
import {
  ChatRecordsInMemory,
  TaskFailuresInMemory,
  TaskHumanActionsInMemory,
} from '@insights/domain/insights.fake-spec';
import {
  ChangeJudgingsInMemory,
  JudgingsInMemory,
  ScoresInMemory,
  SideBySideJudgingsInMemory,
} from '@insights/domain/judging.fake-spec';
import {
  PullRequestRecordsInMemory,
  TaskChangeShapesInMemory,
} from '@insights/domain/pull-requests.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const AT = new Date('2026-09-30T12:00:00.000Z');
const OPENED = new Date('2026-09-30T11:00:00.000Z');
const CLOCK = { now: () => AT, sleep: async () => {} };
const DAY_MS = 24 * 60 * 60 * 1000;

const openingPullRequests = () => {
  const taskPullRequests = new TaskPullRequestsInMemory();

  return {
    taskPullRequests,
    opened: (pullRequest = PULL) =>
      new RecordPullRequestOpening(
        taskPullRequests,
        pendingReviewsInMemory(),
        deletionsInMemory(),
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
      new RecordPullRequestClosing(taskPullRequests, inTransaction).closed({
        workspaceId,
        pullRequest: PULL,
        merged,
        at: AT,
      }),
    state: async () => (await taskPullRequests.forTask(TASK))?.state ?? null,
  };
};

describe('recording a task’s pull request', () => {
  it('records it open once the task opens it', async () => {
    const recorder = openingPullRequests();

    await recorder.opened();

    expect(await recorder.state()).toBe('open');
  });

  it('records it merged once it merges', async () => {
    const recorder = openingPullRequests();
    await recorder.opened();

    await recorder.closed(true);

    expect(await recorder.state()).toBe('merged');
    expect((await recorder.taskPullRequests.forTask(TASK))?.closedAt).toEqual(
      AT,
    );
  });

  it('changes nothing when the same pull request is opened again', async () => {
    const recorder = openingPullRequests();
    await recorder.opened();
    await recorder.closed(true);

    await recorder.opened();

    expect(await recorder.state()).toBe('merged');
  });

  it('ignores a pull request no task opened, or one in another workspace', async () => {
    const recorder = openingPullRequests();
    await recorder.closed(true);
    await recorder.opened();

    await recorder.closed(true, WorkspaceId.of('ws_2'));

    expect(await recorder.state()).toBe('open');
  });
});

const humanActions = new TaskHumanActionsInMemory();

const repositoriesInMemory = () => ({
  records: new RunRecordsInMemory(),
  taskPullRequests: new TaskPullRequestsInMemory(),
  judgings: new JudgingsInMemory(),
  changeJudgings: new ChangeJudgingsInMemory(),
  sideBySideJudgings: new SideBySideJudgingsInMemory(),
  scores: new ScoresInMemory(),
  taskHumanActions: new TaskHumanActionsInMemory(),
  failures: new TaskFailuresInMemory(),
  chats: new ChatRecordsInMemory(),
  pullRequests: new PullRequestRecordsInMemory(),
  shapes: new TaskChangeShapesInMemory(),
  alertStates: new StationAlertStatesInMemory(),
  reviews: pendingReviewsInMemory(),
  configPullRequests: stationConfigPullRequestsInMemory(),
  deletions: deletionsInMemory(),
});

const reviewing = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new RecordPullRequestReview(
    repositories.taskPullRequests,
    repositories.reviews,
    repositories.deletions,
    inTransaction,
    CLOCK,
  );

const opening = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new RecordPullRequestOpening(
    repositories.taskPullRequests,
    repositories.reviews,
    repositories.deletions,
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

describe('keeping a review received before its task’s pull request', () => {
  it('keeps a person’s review until the pull request’s task is received, then dates the first review by it', async () => {
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
      (await repositories.taskPullRequests.forTask(TASK))?.firstReviewAt,
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

  it('keeps no review older than insights ever look back, and lets go of those stored that long', async () => {
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
      (await repositories.taskPullRequests.forTask(TASK))?.firstReviewAt,
    ).toBeNull();
    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('lets go of the pending reviews of a deleted task’s pull request', async () => {
    const repositories = repositoriesInMemory();
    await opening(repositories).opened(OPENING);
    await repositories.reviews.add(WORKSPACE, { pullRequest: PULL, at: AT });

    await new DeleteInsights(repositories, inTransaction).taskPullRequestOfTask(
      WORKSPACE,
      TASK,
    );

    expect(repositories.reviews.stored.size).toBe(0);
  });

  it('lets go of the pending reviews of a deleted team’s pull requests', async () => {
    const repositories = repositoriesInMemory();
    await opening(repositories).opened(OPENING);
    await repositories.reviews.add(WORKSPACE, { pullRequest: PULL, at: AT });

    await new DeleteInsights(
      repositories,
      inTransaction,
    ).taskPullRequestsOfTeam(WORKSPACE, TEAM);

    expect(repositories.reviews.stored.size).toBe(0);
    expect(repositories.taskPullRequests.stored.size).toBe(0);
  });
});

describe('recording what a deleted team did, however late it is received', () => {
  it('records no pull request, failure or review of a team once it is deleted', async () => {
    const repositories = repositoriesInMemory();
    await new DeleteInsights(repositories, inTransaction).runsOfTeam(
      WORKSPACE,
      TEAM,
    );

    await opening(repositories).opened(OPENING);
    await new RecordTaskFailure(
      repositories.failures,
      repositories.deletions,
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

    expect(repositories.taskPullRequests.stored.size).toBe(0);
    expect(repositories.failures.stored.size).toBe(0);
  });

  it('locks the task and its team before it checks whether they were deleted', async () => {
    const repositories = repositoriesInMemory();

    await opening(repositories).opened(OPENING);

    expect(repositories.deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
    ]);
  });
});

describe('deleting insights', () => {
  it('deletes the runs and the pull request of a deleted task', async () => {
    const records = new RunRecordsInMemory();
    const recorder = openingPullRequests();
    await records.add(endedRecord('run_1'));
    await records.add(endedRecord('run_2', { taskId: 'task_2' }));
    await recorder.opened();
    const deleting = new DeleteInsights(
      {
        records,
        taskPullRequests: recorder.taskPullRequests,
        judgings: new JudgingsInMemory(),
        changeJudgings: new ChangeJudgingsInMemory(),
        sideBySideJudgings: new SideBySideJudgingsInMemory(),
        scores: new ScoresInMemory(),
        taskHumanActions: humanActions,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        alertStates: new StationAlertStatesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
        deletions: deletionsInMemory(),
      },
      inTransaction,
    );

    await deleting.runsOfTask(WORKSPACE, TASK);
    await deleting.taskPullRequestOfTask(WORKSPACE, TASK);

    expect(await records.of(RunId.of('run_1'))).toBeNull();
    expect(await records.of(RunId.of('run_2'))).not.toBeNull();
    expect(await recorder.state()).toBeNull();
  });

  it('deletes what it received about a deleted task’s runs before they ended', async () => {
    const records = new RunRecordsInMemory();
    await records.add(
      RunRecord.empty(RunId.of('run_1'), WORKSPACE, TASK).recordCheck(
        'passed',
        RECEIVED_AT,
      ),
    );

    await new DeleteInsights(
      {
        records,
        taskPullRequests: new TaskPullRequestsInMemory(),
        judgings: new JudgingsInMemory(),
        changeJudgings: new ChangeJudgingsInMemory(),
        sideBySideJudgings: new SideBySideJudgingsInMemory(),
        scores: new ScoresInMemory(),
        taskHumanActions: humanActions,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        alertStates: new StationAlertStatesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
        deletions: deletionsInMemory(),
      },
      inTransaction,
    ).runsOfTask(WORKSPACE, TASK);

    expect(records.stored.size).toBe(0);
  });

  it('deletes everything of a deleted workspace', async () => {
    const records = new RunRecordsInMemory();
    const recorder = openingPullRequests();
    await records.add(endedRecord('run_1'));
    await recorder.opened();
    const deleting = new DeleteInsights(
      {
        records,
        taskPullRequests: recorder.taskPullRequests,
        judgings: new JudgingsInMemory(),
        changeJudgings: new ChangeJudgingsInMemory(),
        sideBySideJudgings: new SideBySideJudgingsInMemory(),
        scores: new ScoresInMemory(),
        taskHumanActions: humanActions,
        failures: new TaskFailuresInMemory(),
        chats: new ChatRecordsInMemory(),
        pullRequests: new PullRequestRecordsInMemory(),
        shapes: new TaskChangeShapesInMemory(),
        alertStates: new StationAlertStatesInMemory(),
        reviews: pendingReviewsInMemory(),
        configPullRequests: stationConfigPullRequestsInMemory(),
        deletions: deletionsInMemory(),
      },
      inTransaction,
    );

    await deleting.runsOfWorkspace(WORKSPACE);
    await deleting.taskPullRequestsOfWorkspace(WORKSPACE);

    expect(records.stored.size).toBe(0);
    expect(recorder.taskPullRequests.stored.size).toBe(0);
  });
});
