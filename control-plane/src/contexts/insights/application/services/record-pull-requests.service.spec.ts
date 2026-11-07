import { StationAlertStatesInMemory } from '@insights/alerts.fake-spec';
import { chatsInMemory } from '@insights/application/ports/chats.fake-spec';
import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import { DeleteInsights } from '@insights/application/services/delete-insights.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { PurgeExpiredTombstones } from '@insights/application/services/purge-expired-tombstones.service';
import { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import {
  TaskFailuresInMemory,
  TaskHumanActionsInMemory,
} from '@insights/insights.fake-spec';
import { JudgingsInMemory, ScoresInMemory } from '@insights/judging.fake-spec';
import {
  observedOf,
  PullRequestRecordsInMemory,
  seenOf,
  TaskChangeShapesInMemory,
} from '@insights/pull-requests.fake-spec';
import {
  inTransaction,
  RunRecordsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const SEEN_AT = new Date('2026-09-28T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const repositoriesInMemory = () => ({
  records: new RunRecordsInMemory(),
  judgings: new JudgingsInMemory(),
  scores: new ScoresInMemory(),
  humanActions: new TaskHumanActionsInMemory(),
  failures: new TaskFailuresInMemory(),
  shapes: new TaskChangeShapesInMemory(),
  pullRequests: new PullRequestRecordsInMemory(),
  alertStates: new StationAlertStatesInMemory(),
  chats: chatsInMemory(),
  deletions: deletionsInMemory(),
});

type Repositories = ReturnType<typeof repositoriesInMemory>;

const recording = (repositories: Repositories) =>
  new RecordPullRequests(
    repositories.pullRequests,
    new FactRecorder(repositories.deletions),
    inTransaction,
  );

const deleting = (repositories: Repositories) =>
  new DeleteInsights(repositories, repositories.deletions, inTransaction);

const shaping = (repositories: Repositories) =>
  new RecordChangeShape(
    work,
    repositories.shapes,
    new FactRecorder(repositories.deletions),
    inTransaction,
  );

const ENDED = {
  runId: 'run_1',
  workspaceId: WORKSPACE.value,
  teamId: TEAM.value,
  taskId: TASK.value,
} as EndedRun;

const work = { endedRun: async () => ENDED } as unknown as WorkPort;

const SHAPED = {
  runId: 'run_1',
  taskId: TASK.value,
  workspaceId: WORKSPACE.value,
  shape: {
    changeTitles: ['Retry uploads'],
    changeIntents: ['fix'],
    at: SEEN_AT,
  },
};

describe('recording every pull request', () => {
  it('locks the workspace before it checks what was deleted', async () => {
    const repositories = repositoriesInMemory();

    await recording(repositories).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      observed: observedOf(),
    });
    await recording(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(repositories.deletions.locks).toEqual([
      WORKSPACE.value,
      WORKSPACE.value,
    ]);
  });

  it('locks the task and its team before it notes who owns or reviewed it', async () => {
    const repositories = repositoriesInMemory();

    await recording(repositories).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
      at: SEEN_AT,
    });
    await recording(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TaskId.of('task_2'),
    });

    expect(repositories.deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
      WORKSPACE.value,
      `${WORKSPACE.value} task_2`,
      WORKSPACE.value,
    ]);
  });

  it('keeps a tombstone of a pull request GitHub purged, and turns away what GitHub said no later than that', async () => {
    const repositories = repositoriesInMemory();
    await recording(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    await recording(repositories).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      observed: observedOf({ updatedAt: SEEN_AT, version: 9 }),
    });

    const record = await repositories.pullRequests.at(WORKSPACE, PULL);
    expect(record?.isTombstone).toBe(true);
    expect(record?.seen).toBeNull();
  });

  it('keeps no word of GitHub purging a pull request of a deleted workspace', async () => {
    const repositories = repositoriesInMemory();
    await deleting(repositories).pullRequests(
      DeletionScope.ofWorkspace(WORKSPACE),
    );

    await recording(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).toBeNull();
  });

  it('records no owner from a deleted team, and keeps what GitHub said', async () => {
    const repositories = repositoriesInMemory();
    await recording(repositories).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      observed: observedOf(),
    });
    await deleting(repositories).pullRequests(
      DeletionScope.ofTeam(WORKSPACE, TEAM),
    );

    await recording(repositories).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
      at: SEEN_AT,
    });

    const record = await repositories.pullRequests.at(WORKSPACE, PULL);
    expect(record?.owner).toBeNull();
    expect(record?.seen).not.toBeNull();
  });
});

describe('recording the shape of a task’s change', () => {
  it('locks the task and its team before it checks whether they were deleted', async () => {
    const repositories = repositoriesInMemory();

    await shaping(repositories).shaped(SHAPED);

    expect(repositories.deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
    ]);
    expect(await repositories.shapes.forTask(TASK)).not.toBeNull();
  });

  it('records no shape for a deleted team', async () => {
    const repositories = repositoriesInMemory();
    await deleting(repositories).changeShapes(
      DeletionScope.ofTeam(WORKSPACE, TEAM),
    );

    await shaping(repositories).shaped(SHAPED);

    expect(await repositories.shapes.forTask(TASK)).toBeNull();
  });
});

describe('deleting a task’s or a team’s pull requests', () => {
  it('lets go of the task on each of its pull requests', async () => {
    const repositories = repositoriesInMemory();
    const people = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .assignOwner({ taskId: TASK, teamId: TEAM, openedAt: SEEN_AT }),
    );
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, people)
        .seenAs(seenOf({ number: 8 }))
        .recordReview(TASK),
    );
    const scope = DeletionScope.ofTask(WORKSPACE, TASK);

    await deleting(repositories).pullRequests(scope);

    expect(
      (await repositories.pullRequests.at(WORKSPACE, PULL))?.owner,
    ).toBeNull();
    expect(
      (await repositories.pullRequests.at(WORKSPACE, people))?.reviewTasks,
    ).toEqual([]);
    expect(repositories.deletions.deleted(scope)).toBe(true);
  });

  it('marks a team deleted as it removes the team from its pull requests', async () => {
    const repositories = repositoriesInMemory();
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .assignOwner({ taskId: TASK, teamId: TEAM, openedAt: SEEN_AT }),
    );
    const scope = DeletionScope.ofTeam(WORKSPACE, TEAM);

    await deleting(repositories).pullRequests(scope);

    expect(repositories.deletions.deleted(scope)).toBe(true);
    expect(
      (await repositories.pullRequests.at(WORKSPACE, PULL))?.owner,
    ).toBeNull();
  });
});

describe('purging expired tombstones', () => {
  const purgingAt = (repositories: Repositories, now: () => Date) =>
    new PurgeExpiredTombstones(repositories.pullRequests, inTransaction, {
      now,
      sleep: async () => {},
    });

  const purged = (repositories: Repositories) =>
    recording(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

  it('purges tombstones older than retention and its slack, at most once an hour', async () => {
    const repositories = repositoriesInMemory();
    let now = new Date(SEEN_AT.getTime() + 211 * DAY_MS);
    const purging = purgingAt(repositories, () => now);
    await purged(repositories);

    await purging.processDue();

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).toBeNull();

    await purged(repositories);
    now = new Date(now.getTime() + 30 * 60_000);
    await purging.processDue();

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).not.toBeNull();
  });

  it('keeps a recent tombstone', async () => {
    const repositories = repositoriesInMemory();
    await purged(repositories);

    await purgingAt(
      repositories,
      () => new Date(SEEN_AT.getTime() + 190 * DAY_MS),
    ).processDue();

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).not.toBeNull();
  });
});
