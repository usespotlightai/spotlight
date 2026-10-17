import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import {
  CompleteRunCommand,
  SuspendRunCommand,
} from '@work/application/commands/runner.commands';
import type { Happened } from '@work/application/contracts/happenings.contract';
import {
  HAPPENING_REACTIONS,
  type HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import {
  LEASED_RUN_READER,
  type LeasedRunReaderPort,
} from '@work/application/ports/leased-run-reader.port';
import {
  TASK_NOTES_FROM_HOOKS,
  type TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import { openTeam } from './support/team';

const RUNNER = RunnerId.of('runner_reactions');
const CHANGES_REQUESTED = 'github.pull_request.changes-requested';
const DEFERRED_MOVE_TO_CODE_REVIEW =
  'Heard while a run worked on the task. If the run does not pass the task on, the task moves to Code Review when the run ends.\n\nChanges were requested on the pull request.';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
let line: Line;
let tasks: DrizzleTaskRepository;
let runs: DrizzleRunRepository;

const stationKeyed = (key: string) => {
  const station = line.stationKeyed(StationKey.of(key));

  if (!station) {
    throw new Error(`the Delivery line has no ${key} station`);
  }

  return station;
};

const found = async (id: TaskId): Promise<Task> => {
  const task = await tasks.find(id);

  if (!task) {
    throw new Error(`task ${id.value} is gone`);
  }

  return task;
};

const runOf = async (runId: RunId) => {
  const run = await runs.findById(runId);

  if (!run) {
    throw new Error(`run ${runId.value} is gone`);
  }

  return run;
};

const movedByHand = (task: Task, to: string) =>
  served(app)
    .post(
      `/api/teams/${team.teamId.value}/lines/${line.id.value}/tasks/${task.id.value}/move`,
    )
    .set(TEST_USER_HEADER, team.owner.value)
    .send({
      stationId: stationKeyed(to).id.value,
      revision: task.revision.value,
    })
    .expect(200);

const workingAt = async (
  station: string,
): Promise<{ task: Task; runId: RunId }> => {
  const added = Task.add({
    line,
    at: stationKeyed('backlog').id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: new Date(),
    newId: () => randomUUID(),
  });
  await tasks.add(added);
  await movedByHand(added, station);

  const task = await found(added.id);

  if (!task.currentRunId) {
    throw new Error('the move dispatched the task to no run');
  }

  const runId = task.currentRunId;
  await eventually(() => runs.findById(runId));

  return { task, runId };
};

const happens = async (task: Task, happening: string, summary: string) => {
  const happened: Happened = {
    happening,
    summary,
    answers: happening === CHANGES_REQUESTED,
    state: 'raised',
    concerns: { branch: task.branch.value, marks: [] },
    message: null,
    ourOwn: false,
    opens: null,
  };

  await app
    .get<HappeningReactionsPort>(HAPPENING_REACTIONS)
    .react(team.workspaceId, team.teamId, [happened], randomUUID());
};

const changesRequested = (task: Task) =>
  happens(
    task,
    CHANGES_REQUESTED,
    'Changes were requested on the pull request.',
  );

const merged = (task: Task) =>
  happens(task, 'github.pull_request.merged', 'The pull request was merged.');

const claimed = async (runId: RunId) => {
  await runs.save((await runOf(runId)).claim(RUNNER, new Date()));
};

const endedPassingTo = async (runId: RunId, next: string) => {
  await runs.save(
    (await runOf(runId)).complete(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.of({
        handover: Handover.of({ next, note: 'Uploads retry now.' }),
        session: null,
      }),
    ),
  );
};

const pausedAsking = async (runId: RunId) => {
  await app
    .get(CommandBus)
    .execute(
      new CompleteRunCommand(
        runId.value,
        RUNNER.value,
        0,
        false,
        undefined,
        { next: 'review', note: 'Which queue should I drain?' },
        'session_1',
        false,
        true,
      ),
    );
  expect((await runOf(runId)).state).toBe('waiting');
};

const suspended = async (runId: RunId) => {
  await app
    .get(CommandBus)
    .execute(new SuspendRunCommand(runId.value, RUNNER.value));
  expect((await runOf(runId)).state).toBe('suspended');
};

const answered = (task: Task, from: number, body: string, approve?: boolean) =>
  served(app)
    .post(`/api/workspaces/${team.slug}/inbox/${task.id.value}:${from}/answer`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send({ body, approve })
    .expect(204);

const approvalAsked = async (task: Task, runId: RunId) => {
  const asking = (await found(task.id)).clearFor(
    ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
    ),
    ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
    {
      station: StationName.of('Implementation'),
      body: TaskNoteBody.of('Approve linear.comment?'),
      at: new Date(),
      voice: Voice.station(runId),
    },
    runId,
    null,
  ).task;
  await tasks.save(asking);

  return asking;
};

const awaitingProvision = async () =>
  (
    await runs.awaitingProvision(team.workspaceId, new Date(), {
      skip: 0,
      max: 1_000,
      withSecrets: false,
    })
  ).map((each) => each.id.value);

const atStation = (task: Task, station: string) =>
  eventually(async () => {
    const each = await found(task.id);
    return each.stationId.equals(stationKeyed(station).id) && each;
  });

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  tasks = app.get(DrizzleTaskRepository);
  runs = app.get(DrizzleRunRepository);
  team = await openTeam(db, tasks, `reactions-${randomUUID().slice(0, 8)}`);

  const opening = BUILT_IN_LINES.find((each) =>
    each.role?.equals(LineRole.DELIVERY),
  );

  if (!opening) {
    throw new Error('Spotlight ships no delivery line');
  }

  line = Line.open({
    by: attributedIn(),
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    line: opening,
    newId: () => randomUUID(),
  }).runsOn(HarnessId.of('claude-code'), null);
  await app.get(DrizzleLineRepository).add(line);
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a happening that would move a task while a run works on it (e2e)', () => {
  it('defers the move, leaving the task and its queued run alone', async () => {
    const { task, runId } = await workingAt('implementation');

    await changesRequested(task);

    const after = await found(task.id);
    expect(after.stationId).toEqual(stationKeyed('implementation').id);
    expect(after.currentRunId).toEqual(runId);
    expect(after.deferredMoveTo).toEqual(stationKeyed('code-review').id);
    expect(after.notes[after.notes.length - 1]?.body.value).toBe(
      DEFERRED_MOVE_TO_CODE_REVIEW,
    );
    expect((await runOf(runId)).state).toBe('queued');
  });

  it('tells the working run what it deferred', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);

    await changesRequested(task);

    const pending = await app
      .get<LeasedRunReaderPort>(LEASED_RUN_READER)
      .pendingFor(runId, RUNNER);
    expect(pending?.map((each) => each.body)).toEqual([
      DEFERRED_MOVE_TO_CODE_REVIEW,
    ]);
    expect((await runOf(runId)).stopRequested).toBe(false);
  });

  it('lets the run’s own pass-on win, and drops the deferred move', async () => {
    const { task, runId } = await workingAt('spec');
    await claimed(runId);
    await changesRequested(task);

    await endedPassingTo(runId, 'implementation');

    const passed = await atStation(task, 'implementation');
    expect(passed.deferredMoveTo).toBeNull();
    expect(passed.currentRunId).not.toBeNull();
  });

  it('makes the deferred move once the run puts the task to a person', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await changesRequested(task);

    await endedPassingTo(runId, 'review');

    const moved = await atStation(task, 'code-review');
    expect(moved.awaitingReview).toBe(false);
    expect(moved.currentRunId).not.toBeNull();
    expect(moved.currentRunId).not.toEqual(runId);
  });

  it('still stops the run when a person moves the task', async () => {
    const { task, runId } = await workingAt('implementation');
    await changesRequested(task);

    await movedByHand(await found(task.id), 'backlog');

    const cancelled = await eventually(async () => {
      const run = await runOf(runId);
      return run.hasEnded && run;
    });
    expect(cancelled.outcome?.cancelled).toBe(true);
  });
});

describe('a pull request merged while a run works on the task (e2e)', () => {
  const question =
    'The pull request was merged while Implementation was working. Close the task, or reply to carry on.';

  it('cancels a queued run and asks the person the task is assigned to', async () => {
    const { task, runId } = await workingAt('implementation');

    await merged(task);

    const asked = await found(task.id);
    expect(asked.stationId).toEqual(stationKeyed('implementation').id);
    expect(asked.currentRunId).toBeNull();
    expect(asked.finished).toBe(false);
    expect(asked.awaitingReview).toBe(true);
    expect(asked.assignee).toEqual(team.owner);
    expect(asked.notes[asked.notes.length - 1]?.body.value).toBe(question);

    const cancelled = await eventually(async () => {
      const run = await runOf(runId);
      return run.hasEnded && run;
    });
    expect(cancelled.outcome?.cancelled).toBe(true);
  });

  it('asks a working run to stop', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);

    await merged(task);

    await eventually(async () => (await runOf(runId)).stopRequested);
    expect((await found(task.id)).awaitingReview).toBe(true);
  });

  it('stops a working run and asks over a pending tool approval', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await approvalAsked(task, runId);

    await merged(task);

    await eventually(async () => (await runOf(runId)).stopRequested);
    const asked = await found(task.id);
    expect(asked.currentRunId).toBeNull();
    expect(asked.awaitingReview).toBe(true);
    expect(asked.decisionPending).toBe(false);
    expect(asked.notes[asked.notes.length - 1]?.body.value).toBe(question);
  });

  it('carries on at the station once a person replies', async () => {
    const { task } = await workingAt('implementation');
    await merged(task);
    const asked = await found(task.id);

    await served(app)
      .post(
        `/api/workspaces/${team.slug}/inbox/${task.id.value}:${asked.notes.length - 1}/answer`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ body: 'Carry on, the follow-up still needs doing.' })
      .expect(204);

    const carried = await found(task.id);
    expect(carried.stationId).toEqual(stationKeyed('implementation').id);
    expect(carried.awaitingReview).toBe(false);
    expect(carried.currentRunId).not.toBeNull();
    await eventually(() => runs.findById(carried.currentRunId as RunId));
  });

  it('finishes a task once its run has ended, as before', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await endedPassingTo(runId, 'review');
    await eventually(async () => (await found(task.id)).awaitingReview);

    await merged(task);

    const after = await found(task.id);
    expect(after.stationId).toEqual(stationKeyed('completed').id);
    expect(after.finished).toBe(true);
  });
});

describe('a happening while the current run of the task waits on a person (e2e)', () => {
  const pausedAt = async (station: string) => {
    const { task, runId } = await workingAt(station);
    await claimed(runId);
    await pausedAsking(runId);

    return { task: await found(task.id), runId };
  };

  it.each([
    ['warm', async (_: RunId) => {}],
    ['suspended', suspended],
  ])(
    'defers the move beside the question while the run waits %s',
    async (state, waits) => {
      const { task, runId } = await pausedAt('implementation');
      await waits(runId);

      await changesRequested(task);

      const after = await found(task.id);
      expect(after.stationId).toEqual(stationKeyed('implementation').id);
      expect(after.currentRunId).toEqual(runId);
      expect(after.awaitingReview).toBe(true);
      expect(after.deferredMoveTo).toEqual(stationKeyed('code-review').id);
      expect(
        after.notes.slice(-2).map((each) => [each.kind, each.body.value]),
      ).toEqual([
        ['asked', 'Which queue should I drain?'],
        ['message', DEFERRED_MOVE_TO_CODE_REVIEW],
      ]);
      expect((await runOf(runId)).state).toBe(
        state === 'warm' ? 'waiting' : 'suspended',
      );
    },
  );

  it('makes the deferred move once the answered run ends without passing it on', async () => {
    const { task, runId } = await pausedAt('implementation');
    await changesRequested(task);

    await answered(task, task.notes.length - 1, 'The default one.');
    await eventually(async () => (await runOf(runId)).state === 'claimed');
    await endedPassingTo(runId, 'review');

    const moved = await atStation(task, 'code-review');
    expect(moved.awaitingReview).toBe(false);
    expect(moved.currentRunId).not.toEqual(runId);
  });

  it.each([
    ['warm', async (_: RunId) => {}],
    ['suspended', suspended],
  ])(
    'adds a merge to the open question while the run waits %s, asking nothing again and leaving the run as it is',
    async (state, waits) => {
      const { task, runId } = await pausedAt('implementation');
      await waits(runId);

      await merged(task);

      const after = await found(task.id);
      expect(after.stationId).toEqual(stationKeyed('implementation').id);
      expect(after.currentRunId).toEqual(runId);
      expect(after.awaitingReview).toBe(true);
      expect(after.finished).toBe(false);
      expect(after.notes.filter((each) => each.kind === 'asked')).toHaveLength(
        1,
      );
      expect(after.notes[after.notes.length - 1]?.body.value).toBe(
        'The pull request was merged while Implementation was waiting for an answer. Close the task, or reply to carry on.',
      );

      const run = await runOf(runId);
      expect(run.state).toBe(state === 'warm' ? 'waiting' : 'suspended');
      expect(run.stopRequested).toBe(false);
    },
  );
});

describe('a run-chat message on a task a merge interrupted (e2e)', () => {
  it('answers the question and starts the station again', async () => {
    const { task, runId } = await workingAt('implementation');
    await merged(task);
    await eventually(async () => (await runOf(runId)).hasEnded);

    await served(app)
      .post(`/api/teams/${team.teamId.value}/runs/${runId.value}/messages`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ body: 'Carry on, the follow-up still needs doing.' })
      .expect(204);

    const carried = await found(task.id);
    expect(carried.stationId).toEqual(stationKeyed('implementation').id);
    expect(carried.awaitingReview).toBe(false);
    expect(carried.notes[carried.notes.length - 1]?.kind).toBe('answered');
    expect(carried.currentRunId).not.toBeNull();
    expect(carried.currentRunId).not.toEqual(runId);
    await eventually(() => runs.findById(carried.currentRunId as RunId));
  });
});

describe('a deferred move and what ends the run (e2e)', () => {
  it('survives a tool approval asked and granted mid-run, and applies when the run ends', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await changesRequested(task);
    const asking = await approvalAsked(task, runId);

    await answered(asking, asking.notes.length - 1, '', true);
    expect((await found(task.id)).deferredMoveTo).toEqual(
      stationKeyed('code-review').id,
    );
    await endedPassingTo(runId, 'done');

    const moved = await atStation(task, 'code-review');
    expect(moved.awaitingReview).toBe(false);
  });

  it('applies when a before-hook failure ends the queued run, instead of asking a person', async () => {
    const { task, runId } = await workingAt('implementation');
    await changesRequested(task);

    await expect(
      app.get<TaskNotesFromHooksPort>(TASK_NOTES_FROM_HOOKS).failed({
        taskId: task.id.value,
        stationKey: 'implementation',
        hook: 'core/notify',
        code: 'rejected',
        reason: 'The hook rejected the run.',
        heardAs: randomUUID(),
      }),
    ).resolves.toBe('reported');

    const moved = await found(task.id);
    expect(moved.stationId).toEqual(stationKeyed('code-review').id);
    expect(moved.awaitingReview).toBe(false);
    expect(moved.notes[moved.notes.length - 1]?.failure?.code).toBe('rejected');
    expect(moved.currentRunId).not.toBeNull();
    expect(moved.currentRunId).not.toEqual(runId);
    await eventually(async () => (await runOf(runId)).hasEnded);
  });

  it('is dropped by a merge that adds to a paused run’s question, so the run ending leaves the task with the person', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await pausedAsking(runId);
    await changesRequested(task);
    await merged(task);
    expect((await found(task.id)).deferredMoveTo).toBeNull();

    await runs.save((await runOf(runId)).cancel(new Date()));

    const left = await eventually(async () => {
      const each = await found(task.id);
      return each.currentRunId === null && each;
    });
    expect(left.stationId).toEqual(stationKeyed('implementation').id);
    expect(left.awaitingReview).toBe(true);
  });
});

describe('a reply to an interrupted working run (e2e)', () => {
  it('queues a new run at the station that no runner claims until the stopped run has ended', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await merged(task);
    await eventually(async () => (await runOf(runId)).stopRequested);
    const asked = await found(task.id);

    await answered(asked, asked.notes.length - 1, 'Carry on.');

    const next = (await found(task.id)).currentRunId as RunId;
    await eventually(() => runs.findById(next));
    expect((await runOf(runId)).state).toBe('claimed');
    expect(await awaitingProvision()).not.toContain(next.value);

    await runs.save(
      (await runOf(runId)).complete(RUNNER, RunOutcome.stopped(0)),
    );

    expect(await awaitingProvision()).toContain(next.value);
  });
});
