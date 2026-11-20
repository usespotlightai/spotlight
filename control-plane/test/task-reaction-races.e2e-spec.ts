import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { processedEventsInMemory } from '@work/application/ports/processed-events.fake-spec';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { ChannelChats } from '@work/application/services/channel-chats.service';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import { RunRouting } from '@work/application/services/run-routing.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { TaskRunEnded } from '@work/domain/events/task-run-ended.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const RANK = TaskRank.of('i');

const HAPPENINGS = {
  'changes-requested': 'github.pull_request.changes-requested',
  commented: 'github.pull_request.commented',
  merged: 'github.pull_request.merged',
  'checks-failed': 'github.checks.failed',
} as const;

type Which = keyof typeof HAPPENINGS;
type Waiting = 'working' | 'question' | 'approval';
type Ending = 'review' | 'pass';

type Action =
  | { readonly kind: 'happening'; readonly which: Which }
  | { readonly kind: 'move'; readonly to: 'backlog' | 'completed' }
  | { readonly kind: 'run-ends'; readonly ending: Ending };

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('happening' as const),
      which: fc.constantFrom<Which>(
        'changes-requested',
        'commented',
        'merged',
        'checks-failed',
      ),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('move' as const),
      to: fc.constantFrom('backlog' as const, 'completed' as const),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('run-ends' as const),
      ending: fc.constantFrom<Ending>('review', 'pass'),
    }),
  },
);

const actions = fc.array(action, { minLength: 2, maxLength: 5 });
const waiting = fc.constantFrom<Waiting>('working', 'question', 'approval');

let database: TestDatabase;
let context: DrizzleContext;
let tasks: DrizzleTaskRepository;
let line: LineMap;
let owner: UserId;
const committed: DomainEvent[] = [];

const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of(randomUUID()),
};

const placements: TaskPlacementsPort = { placementsAt: async () => [] };

const unused = async (): Promise<never> => {
  throw new Error('a happening without files touches no attachment');
};

const files: AttachmentStorePort = {
  grant: unused,
  received: unused,
  stored: unused,
  taken: unused,
  save: unused,
  copy: unused,
  link: unused,
  linkPending: unused,
  open: unused,
};

const lines: LineMapsPort = {
  find: async () => line,
  findByStation: async () => line,
  ofTeam: async () => [line],
  ofWorkspace: async () => [line],
  candidate: unused,
};

const silent = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const reactions = (): ReactToHappenings =>
  new ReactToHappenings(
    tasks,
    placements,
    lines,
    dispatch,
    context,
    clock,
    { generate: () => randomUUID() },
    { byEmail: async () => null },
    files,
    processedEventsInMemory(),
    silent,
    {
      reached: async () => null,
      answer: async () => {},
    } as unknown as ChannelChats,
    { of: async () => [] },
    { membersOf: async () => TeamMembers.of([owner]) },
  );

const stationAt = (key: string): Station => {
  const station = line.stationKeyed(StationKey.of(key));

  if (!station) {
    throw new Error(`the delivery line has no ${key} station`);
  }

  return station;
};

beforeAll(async () => {
  database = await openDatabase('task_reaction_races');
  context = new DrizzleContext(database.db);
  tasks = new DrizzleTaskRepository(context, {
    dispatch: async (events) =>
      context.afterCommit(() => committed.push(...events)),
  });

  const team = await createTeam(
    database.db,
    tasks,
    `races-${randomUUID().slice(0, 8)}`,
  );
  owner = team.owner;
  line = deliveryLineOf({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    harness: HarnessId.of('dev'),
    newId: () => randomUUID(),
  });

  await database.db.insert(schema.line).values({
    id: line.id.value,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: line.key.value,
    name: line.name.value,
  });
  await insertStations(
    database.db,
    line.stations.map((each) => ({
      id: each.id.value,
      workspaceId: team.workspaceId.value,
      lineId: line.id.value,
      key: each.key.value,
      name: each.name.value,
      position: each.position,
      kind: each.kind,
    })),
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const asking = (task: Task, run: RunId, how: Waiting): Task => {
  const note = {
    line,
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: NOW,
    voice: Voice.station(run),
  };

  switch (how) {
    case 'working':
      return task;
    case 'question':
      return task.awaitTurn({
        turn: AwaitedTurn.of(run, 1),
        note,
        session: HarnessSession.of('session_1'),
        runner: RunnerId.of('runner_1'),
      });
    case 'approval':
      return task.clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        note,
        run,
        null,
      ).task;
  }
};

interface Working {
  readonly task: Task;
  readonly run: RunId;
}

const working = async (how: Waiting): Promise<Working> => {
  const opened = Task.add({
    line,
    at: stationAt('implementation').id,
    title: TaskTitle.of('Retry uploads'),
    rank: RANK,
    createdBy: owner,
    now: NOW,
    newId: () => randomUUID(),
  });
  const run = RunId.of(randomUUID());

  await tasks.add(asking(opened.assignRun(run, line), run, how));

  const task = await tasks.find(opened.id);

  if (!task) {
    throw new Error('the task that was just added could not be read back');
  }

  return { task, run };
};

const happened = (task: Task, which: Which): Happened => ({
  happening: HAPPENINGS[which],
  summary: `The pull request was ${which}.`,
  answers: which === 'changes-requested' || which === 'commented',
  state: 'raised',
  correlationKeys: { branch: task.branch.value, marks: [] },
  message: null,
  ourOwn: false,
  opens: null,
});

const found = async (id: TaskId): Promise<Task> => {
  const task = await tasks.find(id);

  if (!task) {
    throw new Error(`task ${id.value} is gone`);
  }

  return task;
};

const handoverOf = (ending: Ending) => {
  const body = TaskNoteBody.of('Uploads retry now.');

  return ending === 'pass'
    ? ResolvedHandover.pass(stationAt('code-review').id, body)
    : ResolvedHandover.review(body);
};

type Done = 'reacted' | 'saved' | 'nothing';

const performed = async (
  seen: Working,
  each: Action,
  wrote: () => void,
): Promise<Done> => {
  switch (each.kind) {
    case 'happening': {
      const answer = await reactions().react(
        line.workspaceId,
        line.teamId,
        [happened(seen.task, each.which)],
        null,
      );

      if (answer.kind !== 'reacted') {
        throw new Error(answer.reason);
      }

      return 'reacted';
    }
    case 'move':
      return context.inTransaction<Done>(async () => {
        const task = (await found(seen.task.id)).assertRevision(
          seen.task.revision,
        );
        const to = stationAt(each.to);
        const placed = task.placeAt(
          line,
          to.id,
          RANK,
          {
            line,
            body: TaskNoteBody.movedTo(to.name),
            at: NOW,
            voice: Voice.station(),
          },
          { mover: owner },
        );

        await tasks.save(await handedToRun(dispatch, placed.task, line));
        context.afterCommit(wrote);

        return 'saved';
      });
    case 'run-ends':
      return context.inTransaction<Done>(async () => {
        const task = await found(seen.task.id);

        if (!task.hasCurrentRun(seen.run)) {
          return 'nothing';
        }

        await tasks.save(
          await new RunRouting(placements, dispatch, clock).routed(
            handoverOf(each.ending),
            task,
            line,
            seen.run,
          ),
        );
        context.afterCommit(wrote);

        return 'saved';
      });
  }
};

const EXPECTED_REFUSALS = [
  TaskVersionConflictError,
  StaleTaskRevisionError,
  MoveDeniedError,
  InvalidTaskTransitionError,
];

interface Race {
  readonly before: Working;
  readonly after: Task;
  readonly actions: readonly Action[];
  readonly settled: readonly PromiseSettledResult<Done>[];
  readonly events: readonly DomainEvent[];
  readonly ranOut: boolean;
}

const raced = async (how: Waiting, each: readonly Action[]): Promise<Race> => {
  const before = await working(how);
  let ranOut = false;

  committed.length = 0;

  const settled = await Promise.allSettled(
    each.map((one) =>
      performed(before, one, () => {
        ranOut ||= one.kind === 'run-ends';
      }),
    ),
  );

  return {
    before,
    after: await found(before.task.id),
    actions: each,
    settled,
    events: [...committed],
    ranOut,
  };
};

const runsIn = (
  events: readonly DomainEvent[],
  type: typeof TaskRunAssigned | typeof TaskRunDetached | typeof TaskRunEnded,
  task: TaskId,
): readonly string[] =>
  events.flatMap((event) =>
    event instanceof type && event.taskId.equals(task)
      ? [event.runId.value]
      : [],
  );

const RACES = { numRuns: 60 };

const race = (holds: (outcome: Race) => boolean) =>
  fc.asyncProperty(waiting, actions, async (how, each) =>
    holds(await raced(how, each)),
  );

describe('writes that race on one task (e2e)', () => {
  it('lands every happening, whatever else writes the task at the same time', async () => {
    await fc.assert(
      race(({ actions: each, settled }) =>
        settled.every(
          (result, at) =>
            each[at]?.kind !== 'happening' || result.status === 'fulfilled',
        ),
      ),
      RACES,
    );
  });

  it('turns away a racing write only as stale, and leaves a task that loads', async () => {
    await fc.assert(
      race(
        ({ settled, after }) =>
          settled.every(
            (result) =>
              result.status === 'fulfilled' ||
              EXPECTED_REFUSALS.some((type) => result.reason instanceof type),
          ) && after.notes.every((note, at) => note.position.value === at),
      ),
      RACES,
    );
  });

  it('leaves exactly one live run, the one the task holds', async () => {
    await fc.assert(
      race(({ before, after, events, ranOut }) => {
        const id = before.task.id;
        const assigned = runsIn(events, TaskRunAssigned, id);
        const letGo = [
          ...runsIn(events, TaskRunDetached, id),
          ...runsIn(events, TaskRunEnded, id),
        ];
        const live = [before.run.value, ...assigned].filter(
          (run) =>
            !letGo.includes(run) && !(ranOut && run === before.run.value),
        );

        return (
          new Set(letGo).size === letGo.length &&
          live.length === (after.currentRunId ? 1 : 0) &&
          (after.currentRunId === null || live[0] === after.currentRunId.value)
        );
      }),
      RACES,
    );
  });

  it('finishes the task when a merge races other writes', async () => {
    await fc.assert(
      race(
        ({ actions: each, after }) =>
          !each.some(
            (one) => one.kind === 'happening' && one.which === 'merged',
          ) ||
          (after.stationId.equals(line.completed.id) &&
            after.finished &&
            after.currentRunId === null),
      ),
      RACES,
    );
  });
});
