import { randomUUID } from 'node:crypto';
import { Line } from '@lines/domain/aggregates/line.aggregate';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { DrizzleLineRepository } from '@lines/infrastructure/persistence/drizzle/repositories/line.repository';
import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { CompleteRunCommand } from '@runs/application/commands/runner.commands';
import { claimer } from '@runs/domain/aggregates/run.fake-spec';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import {
  HAPPENING_REACTIONS,
  type HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import {
  TASK_NOTES_FROM_HOOKS,
  type TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import { RunWorks } from '@work/application/services/run-works.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import { mapOf, projectStations } from './support/stations';
import { createTeam } from './support/team';

const RUNNER = RunnerId.of('runner_reactions');
const CHANGES_REQUESTED = 'github.pull_request.changes-requested';
const DEFERRED_MOVE_TO_CODE_REVIEW =
  'This arrived while a run was in progress on the task. If the run does not pass the task on, the task moves to Code Review when the run ends.\n\nChanges were requested on the pull request.';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let line: LineMap;
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
    correlationKeys: { branch: task.branch.value, marks: [] },
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
  await runs.save(
    (await runOf(runId)).claim(
      claimer(RUNNER, team.workspaceId.value),
      new Date(),
    ),
  );
};

const endedPassingTo = async (runId: RunId, next: string) => {
  await app.get(CommandBus).execute(
    new CompleteRunCommand(runId.value, RUNNER.value, 0, false, undefined, {
      next,
      note: 'Uploads retry now.',
    }),
  );
  await eventually(async () => {
    const run = await runOf(runId);

    return run.hasEnded || run.turn?.state === 'kept';
  });
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
      ),
    );
  expect((await runOf(runId)).state).toBe('suspended');
  await eventually(async () => (await runOf(runId)).turn?.state === 'kept');
};

const answered = (task: Task, from: number, body: string, approve?: boolean) =>
  served(app)
    .post(`/api/workspaces/${team.slug}/inbox/${task.id.value}:${from}/answer`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send({ body, approve })
    .expect(204);

const approvalRequested = async (task: Task, runId: RunId) => {
  const asking = (await found(task.id)).clearFor(
    ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
    ),
    ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
    {
      line: null,
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
  ClaimOrder.provisionable(
    await runs.awaitingProvision(team.workspaceId, new Date(), {
      skip: 0,
      max: 1_000,
      withSecrets: false,
      avoiding: [],
    }),
    new Date(),
    false,
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
  team = await createTeam(db, tasks, `reactions-${randomUUID().slice(0, 8)}`);

  const opening = BUILT_IN_LINES.find((each) =>
    each.role?.equals(LineRole.DELIVERY),
  );

  if (!opening) {
    throw new Error('Spotlight ships no delivery line');
  }

  const created = Line.create({
    by: changeActorIn(),
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    line: opening,
    harness: HarnessId.of('claude-code'),
    newId: () => randomUUID(),
  });
  await app.get(DrizzleLineRepository).add(created);
  await projectStations(
    db,
    created.stations.map((each) => each.id.value),
  );
  line = mapOf(created);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
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
      .get(RunWorks)
      .pendingFor(runId.value, RUNNER.value);
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

  it('tells a working run to stop', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);

    await merged(task);

    await eventually(async () => (await runOf(runId)).stopRequested);
    expect((await found(task.id)).awaitingReview).toBe(true);
  });

  it('stops a working run and asks over a pending tool approval', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await approvalRequested(task, runId);

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

  it('defers the move beside the question while the run is suspended', async () => {
    const { task, runId } = await pausedAt('implementation');

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
    expect((await runOf(runId)).state).toBe('suspended');
  });

  it('makes the deferred move once the answered run ends without passing it on', async () => {
    const { task, runId } = await pausedAt('implementation');
    await changesRequested(task);

    await answered(task, task.notes.length - 1, 'The default one.');
    await eventually(async () => (await runOf(runId)).state === 'queued');
    await claimed(runId);
    await endedPassingTo(runId, 'review');

    const moved = await atStation(task, 'code-review');
    expect(moved.awaitingReview).toBe(false);
    expect(moved.currentRunId).not.toEqual(runId);
  });

  it('finishes the task on a merge while the run is suspended, ending the run', async () => {
    const { task, runId } = await pausedAt('implementation');

    await merged(task);

    const after = await found(task.id);
    expect(after.stationId).toEqual(stationKeyed('completed').id);
    expect(after.finished).toBe(true);
    expect(after.currentRunId).toBeNull();
    expect(after.awaitingReview).toBe(false);

    await eventually(async () => (await runOf(runId)).hasEnded);
    expect((await found(task.id)).finished).toBe(true);
  });
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
  it('survives a tool approval requested and approved mid-run, and applies when the run ends', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await changesRequested(task);
    const asking = await approvalRequested(task, runId);

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
        receivedAs: randomUUID(),
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

  it('gives way to a merge that finishes a paused task', async () => {
    const { task, runId } = await workingAt('implementation');
    await claimed(runId);
    await pausedAsking(runId);
    await changesRequested(task);
    await merged(task);

    const finished = await found(task.id);
    expect(finished.stationId).toEqual(stationKeyed('completed').id);
    expect(finished.finished).toBe(true);
    expect(finished.currentRunId).toBeNull();
    expect(finished.deferredMoveTo).toBeNull();
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
      (await runOf(runId)).complete(
        RUNNER,
        RunOutcome.stopped(ExitCode.of(0)),
        HandoverReport.none(),
        new Date(),
      ),
    );

    expect(await awaitingProvision()).toContain(next.value);
  });
});
