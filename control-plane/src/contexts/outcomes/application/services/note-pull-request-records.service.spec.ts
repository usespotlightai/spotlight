import { deletionsInMemory } from '@outcomes/application/ports/deletions.fake-spec';
import { pendingReviewsInMemory } from '@outcomes/application/ports/pending-reviews.fake-spec';
import { stationConfigPullRequestsInMemory } from '@outcomes/application/ports/station-config-pull-requests.fake-spec';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { DeleteOutcomes } from '@outcomes/application/services/delete-outcomes.service';
import { NoteChangeShaped } from '@outcomes/application/services/note-change-shaped.service';
import { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import { PurgeExpiredTombstones } from '@outcomes/application/services/purge-expired-tombstones.service';
import { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import { PullRequestRecordVersionConflictError } from '@outcomes/domain/exceptions/pull-request-record-version-conflict.error';
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
  inTransaction,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  PullRequestRecordsInMemory,
  seenOf,
  TaskChangeShapesInMemory,
} from '@outcomes/domain/pull-requests.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const SEEN_AT = new Date('2026-09-28T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

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
  deletions: deletionsInMemory(),
});

const noting = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new NotePullRequestRecords(
    repositories.pullRequests,
    repositories.deletions,
    inTransaction,
  );

const deleting = (repositories: ReturnType<typeof repositoriesInMemory>) =>
  new DeleteOutcomes(repositories, inTransaction);

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

describe('noting every pull request', () => {
  it('locks the workspace and the pull request before it checks what was deleted', async () => {
    const repositories = repositoriesInMemory();

    await noting(repositories).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      seen: seenOf(),
    });
    await noting(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(repositories.deletions.locks).toEqual([
      WORKSPACE.value,
      `${WORKSPACE.value} ${PULL.value}`,
      WORKSPACE.value,
      `${WORKSPACE.value} ${PULL.value}`,
    ]);
  });

  it('locks the task, its team and the pull request before it notes who owns or reviewed it', async () => {
    const repositories = repositoriesInMemory();

    await noting(repositories).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
    });
    await noting(repositories).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TaskId.of('task_2'),
    });

    expect(repositories.deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
      `${WORKSPACE.value} ${PULL.value}`,
      `${WORKSPACE.value} task_2`,
      `${WORKSPACE.value} ${PULL.value}`,
    ]);
  });

  it('turns away what GitHub said no later than it purged the pull request', async () => {
    const repositories = repositoriesInMemory();
    await noting(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    await noting(repositories).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      seen: seenOf({ updatedAt: SEEN_AT, version: 9 }),
    });

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).toBeNull();
  });

  it('keeps no word of GitHub purging a pull request of a deleted workspace', async () => {
    const repositories = repositoriesInMemory();
    await deleting(repositories).pullRequestsOfWorkspace(WORKSPACE);

    await noting(repositories).purgedByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(
      await repositories.deletions.tombstoneOf(WORKSPACE, PULL),
    ).toBeNull();
  });

  it('records no owner from a deleted team', async () => {
    const repositories = repositoriesInMemory();
    await deleting(repositories).pullRequestsOfTeam(WORKSPACE, TEAM);

    await noting(repositories).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
    });

    expect(await repositories.pullRequests.at(WORKSPACE, PULL)).toBeNull();
  });
});

describe('noting the shape of a task’s change', () => {
  it('locks the task and its team before it checks whether they were deleted', async () => {
    const repositories = repositoriesInMemory();

    await new NoteChangeShaped(
      work,
      repositories.shapes,
      repositories.deletions,
      inTransaction,
    ).shaped(SHAPED);

    expect(repositories.deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
    ]);
    expect(await repositories.shapes.forTask(TASK)).not.toBeNull();
  });

  it('records no shape for a deleted team', async () => {
    const repositories = repositoriesInMemory();
    await deleting(repositories).pullRequestsOfTeam(WORKSPACE, TEAM);

    await new NoteChangeShaped(
      work,
      repositories.shapes,
      repositories.deletions,
      inTransaction,
    ).shaped(SHAPED);

    expect(await repositories.shapes.forTask(TASK)).toBeNull();
  });
});

describe('deleting a task’s or a team’s pull requests', () => {
  it('lets go of each pull request on its own, trying again where it changed meanwhile', async () => {
    const repositories = repositoriesInMemory();
    const people = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .assignOwner({ taskId: TASK, teamId: TEAM }),
    );
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, people)
        .seenAs(seenOf({ number: 8 }))
        .recordReview(TASK),
    );
    const saving = repositories.pullRequests.save.bind(
      repositories.pullRequests,
    );
    let collisions = 1;
    repositories.pullRequests.save = async (record) => {
      if (collisions > 0) {
        collisions -= 1;
        throw new PullRequestRecordVersionConflictError(
          record.pullRequest.value,
        );
      }
      await saving(record);
    };

    await deleting(repositories).pullRequestsOfTask(WORKSPACE, TASK);

    expect(
      (await repositories.pullRequests.at(WORKSPACE, PULL))?.owner,
    ).toBeNull();
    expect(
      (await repositories.pullRequests.at(WORKSPACE, people))?.reviewTasks,
    ).toEqual([]);
    expect(await repositories.deletions.isDeleted(WORKSPACE, TASK)).toBe(true);
  });

  it('marks a team deleted before it removes the team from its pull requests', async () => {
    const repositories = repositoriesInMemory();
    await repositories.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .assignOwner({ taskId: TASK, teamId: TEAM }),
    );

    await deleting(repositories).pullRequestsOfTeam(WORKSPACE, TEAM);

    expect(await repositories.deletions.isDeleted(WORKSPACE, null, TEAM)).toBe(
      true,
    );
    expect(
      (await repositories.pullRequests.at(WORKSPACE, PULL))?.owner,
    ).toBeNull();
  });
});

describe('purging expired tombstones', () => {
  it('purges tombstones older than retention and its slack, at most once an hour', async () => {
    const deletions = deletionsInMemory();
    let now = new Date(SEEN_AT.getTime() + 211 * DAY_MS);
    const purging = new PurgeExpiredTombstones(deletions, {
      now: () => now,
      sleep: async () => {},
    });
    await deletions.deletePullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });

    await purging.processDue();

    expect(await deletions.tombstoneOf(WORKSPACE, PULL)).toBeNull();

    await deletions.deletePullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });
    now = new Date(now.getTime() + 30 * 60_000);
    await purging.processDue();

    expect(await deletions.tombstoneOf(WORKSPACE, PULL)).not.toBeNull();
  });

  it('keeps a recent tombstone', async () => {
    const deletions = deletionsInMemory();
    await deletions.deletePullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });

    await new PurgeExpiredTombstones(deletions, {
      now: () => new Date(SEEN_AT.getTime() + 190 * DAY_MS),
      sleep: async () => {},
    }).processDue();

    expect(await deletions.tombstoneOf(WORKSPACE, PULL)).not.toBeNull();
  });
});
