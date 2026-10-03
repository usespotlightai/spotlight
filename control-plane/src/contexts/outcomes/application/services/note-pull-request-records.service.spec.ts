import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import { pendingReviewsInMemory } from '@outcomes/application/ports/pending-reviews.fake-spec';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { DropExpiredTombstones } from '@outcomes/application/services/drop-expired-tombstones.service';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { NoteChangeShaped } from '@outcomes/application/services/note-change-shaped.service';
import { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import { PullRequestRecordMovedOnError } from '@outcomes/domain/exceptions/pull-request-record-moved-on.error';
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

const heldFor = () => ({
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
  forgotten: forgottenInMemory(),
});

const noting = (held: ReturnType<typeof heldFor>) =>
  new NotePullRequestRecords(held.pullRequests, held.forgotten, inTransaction);

const forgetting = (held: ReturnType<typeof heldFor>) =>
  new ForgetOutcomes(held, inTransaction);

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
  it('holds the workspace and the pull request before it checks what was forgotten', async () => {
    const held = heldFor();

    await noting(held).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      seen: seenOf(),
    });
    await noting(held).forgottenByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(held.forgotten.holds).toEqual([
      WORKSPACE.value,
      `${WORKSPACE.value} ${PULL.value}`,
      WORKSPACE.value,
      `${WORKSPACE.value} ${PULL.value}`,
    ]);
  });

  it('holds the task, its team and the pull request before it notes who owns or reviewed it', async () => {
    const held = heldFor();

    await noting(held).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
    });
    await noting(held).reviewed({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TaskId.of('task_2'),
    });

    expect(held.forgotten.holds).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
      `${WORKSPACE.value} ${PULL.value}`,
      `${WORKSPACE.value} task_2`,
      `${WORKSPACE.value} ${PULL.value}`,
    ]);
  });

  it('turns away what GitHub said no later than it forgot the pull request', async () => {
    const held = heldFor();
    await noting(held).forgottenByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    await noting(held).seen({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      seen: seenOf({ updatedAt: SEEN_AT, version: 9 }),
    });

    expect(await held.pullRequests.at(WORKSPACE, PULL)).toBeNull();
  });

  it('keeps no word of GitHub forgetting a pull request of a closed workspace', async () => {
    const held = heldFor();
    await forgetting(held).pullRequestsOfWorkspace(WORKSPACE);

    await noting(held).forgottenByGitHub({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      updatedAt: SEEN_AT,
    });

    expect(await held.forgotten.tombstoneOf(WORKSPACE, PULL)).toBeNull();
  });

  it('records no owner from a disbanded team', async () => {
    const held = heldFor();
    await forgetting(held).pullRequestsOfTeam(WORKSPACE, TEAM);

    await noting(held).owned({
      workspaceId: WORKSPACE,
      pullRequest: PULL,
      taskId: TASK,
      teamId: TEAM,
    });

    expect(await held.pullRequests.at(WORKSPACE, PULL)).toBeNull();
  });
});

describe('noting the shape of a task’s change', () => {
  it('holds the task and its team before it checks whether they were forgotten', async () => {
    const held = heldFor();

    await new NoteChangeShaped(
      work,
      held.shapes,
      held.forgotten,
      inTransaction,
    ).shaped(SHAPED);

    expect(held.forgotten.holds).toEqual([
      `${WORKSPACE.value} ${TEAM.value} ${TASK.value}`,
    ]);
    expect(await held.shapes.forTask(TASK)).not.toBeNull();
  });

  it('records no shape for a disbanded team', async () => {
    const held = heldFor();
    await forgetting(held).pullRequestsOfTeam(WORKSPACE, TEAM);

    await new NoteChangeShaped(
      work,
      held.shapes,
      held.forgotten,
      inTransaction,
    ).shaped(SHAPED);

    expect(await held.shapes.forTask(TASK)).toBeNull();
  });
});

describe('forgetting a task’s or a team’s pull requests', () => {
  it('lets go of each pull request on its own, trying again where it changed meanwhile', async () => {
    const held = heldFor();
    const people = PullRequestUrl.of('https://github.com/acme/api/pull/8');
    await held.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .ownedBy({ taskId: TASK, teamId: TEAM }),
    );
    await held.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, people)
        .seenAs(seenOf({ number: 8 }))
        .reviewedBy(TASK),
    );
    const saving = held.pullRequests.save.bind(held.pullRequests);
    let collisions = 1;
    held.pullRequests.save = async (record) => {
      if (collisions > 0) {
        collisions -= 1;
        throw new PullRequestRecordMovedOnError(record.pullRequest.value);
      }
      await saving(record);
    };

    await forgetting(held).pullRequestsOfTask(WORKSPACE, TASK);

    expect((await held.pullRequests.at(WORKSPACE, PULL))?.owner).toBeNull();
    expect(
      (await held.pullRequests.at(WORKSPACE, people))?.reviewTasks,
    ).toEqual([]);
    expect(await held.forgotten.forgot(WORKSPACE, TASK)).toBe(true);
  });

  it('marks a team forgotten before letting go of its pull requests', async () => {
    const held = heldFor();
    await held.pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, PULL)
        .seenAs(seenOf())
        .ownedBy({ taskId: TASK, teamId: TEAM }),
    );

    await forgetting(held).pullRequestsOfTeam(WORKSPACE, TEAM);

    expect(await held.forgotten.forgot(WORKSPACE, null, TEAM)).toBe(true);
    expect((await held.pullRequests.at(WORKSPACE, PULL))?.owner).toBeNull();
  });
});

describe('dropping what GitHub forgot long ago', () => {
  it('drops words of forgetting older than retention and its slack, at most once an hour', async () => {
    const forgotten = forgottenInMemory();
    let now = new Date(SEEN_AT.getTime() + 211 * DAY_MS);
    const dropping = new DropExpiredTombstones(forgotten, {
      now: () => now,
      sleep: async () => {},
    });
    await forgotten.forgetPullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });

    await dropping.workDue();

    expect(await forgotten.tombstoneOf(WORKSPACE, PULL)).toBeNull();

    await forgotten.forgetPullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });
    now = new Date(now.getTime() + 30 * 60_000);
    await dropping.workDue();

    expect(await forgotten.tombstoneOf(WORKSPACE, PULL)).not.toBeNull();
  });

  it('keeps a recent word of forgetting', async () => {
    const forgotten = forgottenInMemory();
    await forgotten.forgetPullRequest(WORKSPACE, PULL, { updatedAt: SEEN_AT });

    await new DropExpiredTombstones(forgotten, {
      now: () => new Date(SEEN_AT.getTime() + 190 * DAY_MS),
      sleep: async () => {},
    }).workDue();

    expect(await forgotten.tombstoneOf(WORKSPACE, PULL)).not.toBeNull();
  });
});
