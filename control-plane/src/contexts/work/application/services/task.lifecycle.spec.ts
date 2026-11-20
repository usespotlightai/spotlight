import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import { LineResuming } from '@work/application/services/line-resuming.service';
import { RunRouting } from '@work/application/services/run-routing.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { TaskRunEnded } from '@work/domain/events/task-run-ended.event';
import { AssignedToAnotherPersonError } from '@work/domain/exceptions/assigned-to-another-person.error';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { NotOnTheTeamAskedError } from '@work/domain/exceptions/not-on-the-team-asked.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { TaskOnHoldError } from '@work/domain/exceptions/task-on-hold.error';
import { ConversationAudience } from '@work/domain/services/conversation-audience';
import { Placement } from '@work/domain/services/placement';
import { ReactionFor } from '@work/domain/services/reaction-for';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import type { HappeningPayload } from '@work/domain/value-objects/happening-payload';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const START = new Date('2026-11-20T09:00:00.000Z');
const TEAM_ID = TeamId.of('team_1');
const PEOPLE = {
  leon: UserId.of('user_leon'),
  maya: UserId.of('user_maya'),
} as const;
const TEAM = TeamMembers.of([PEOPLE.leon, PEOPLE.maya]);
const LINEAR = IntegrationName.of('linear');
const PULL_REQUESTS = {
  api: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  docs: PullRequestUrl.of('https://github.com/acme/docs/pull/3'),
} as const;
const HAPPENINGS = {
  'changes-requested': 'github.pull_request.changes-requested',
  commented: 'github.pull_request.commented',
  merged: 'github.pull_request.merged',
  'checks-failed': 'github.checks.failed',
} as const;
const ANSWERING: readonly Which[] = ['changes-requested', 'commented'];

const lineOf = (): LineMap => {
  let next = 0;

  return deliveryLineOf({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM_ID,
    harness: HarnessId.of('dev'),
    newId: () => `id_${next++}`,
  });
};

const LINE = lineOf();

const STATION_KEYS = [
  'backlog',
  'triage',
  'spec',
  'implementation',
  'code-review',
  'completed',
] as const;

type Key = (typeof STATION_KEYS)[number];
type Person = keyof typeof PEOPLE;
type Repo = keyof typeof PULL_REQUESTS;
type Which = keyof typeof HAPPENINGS;
type Actor = Person | 'holder';
type Ending = 'done' | 'review' | 'failed' | 'pass';

const stationAt = (key: Key): Station => {
  const station = LINE.stationKeyed(StationKey.of(key));

  if (!station) {
    throw new Error(`the delivery line has no ${key} station`);
  }

  return station;
};

const COMPLETED = LINE.completed.id;
const CODE_REVIEW = stationAt('code-review').id;

type Step =
  | { readonly kind: 'dispatch' }
  | { readonly kind: 'stray-assign' }
  | { readonly kind: 'assign'; readonly to: Person | null }
  | {
      readonly kind: 'run-ends';
      readonly stale: boolean;
      readonly ending: Ending;
      readonly pick: number;
    }
  | { readonly kind: 'turn-kept'; readonly stale: boolean }
  | { readonly kind: 'ask-approval'; readonly of: Person | null }
  | { readonly kind: 'ask-connection'; readonly of: Person }
  | { readonly kind: 'connected'; readonly by: Person }
  | { readonly kind: 'answer'; readonly by: Person; readonly approve: boolean }
  | { readonly kind: 'resolve'; readonly by: Person }
  | { readonly kind: 'message'; readonly by: Person }
  | {
      readonly kind: 'resume';
      readonly by: Actor;
      readonly next: HoldEnd;
      readonly pick: number;
    }
  | {
      readonly kind: 'move';
      readonly by: Actor;
      readonly to: Key;
      readonly stale: boolean;
    }
  | {
      readonly kind: 'happening';
      readonly which: Which;
      readonly anchored: boolean;
      readonly closes: Repo | null;
    }
  | { readonly kind: 'pr-opened'; readonly repo: Repo }
  | { readonly kind: 'pr-closed'; readonly repo: Repo }
  | { readonly kind: 'pr-reopened'; readonly repo: Repo }
  | { readonly kind: 'hook-failed' }
  | { readonly kind: 'run-dropped' }
  | { readonly kind: 'delete' };

const person = fc.constantFrom<Person>('leon', 'maya');
const actor = fc.oneof(
  { weight: 1, arbitrary: person },
  { weight: 1, arbitrary: fc.constant<Actor>('holder') },
);
const repo = fc.constantFrom<Repo>('api', 'docs');
const pick = fc.nat({ max: 5 });
const rarely = fc.oneof(
  { weight: 4, arbitrary: fc.constant(false) },
  { weight: 1, arbitrary: fc.constant(true) },
);

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 1, arbitrary: fc.constant({ kind: 'dispatch' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'stray-assign' as const }) },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('assign' as const),
      to: fc.option(person, { nil: null }),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('run-ends' as const),
      stale: rarely,
      ending: fc.constantFrom<Ending>('done', 'review', 'failed', 'pass'),
      pick,
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('turn-kept' as const),
      stale: rarely,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('ask-approval' as const),
      of: fc.option(person, { nil: null }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('ask-connection' as const),
      of: person,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('connected' as const),
      by: person,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('answer' as const),
      by: person,
      approve: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('resolve' as const), by: person }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('message' as const), by: person }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('resume' as const),
      by: actor,
      next: fc.constantFrom<HoldEnd>('continue', 'move-on', 'finish'),
      pick,
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('move' as const),
      by: actor,
      to: fc.oneof(
        {
          weight: 16,
          arbitrary: fc.constantFrom<Key>(
            ...STATION_KEYS.filter((key) => key !== 'completed'),
          ),
        },
        { weight: 1, arbitrary: fc.constant<Key>('completed') },
      ),
      stale: rarely,
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('happening' as const),
      which: fc.oneof(
        {
          weight: 6,
          arbitrary: fc.constantFrom<Which>(
            'changes-requested',
            'commented',
            'checks-failed',
          ),
        },
        { weight: 1, arbitrary: fc.constant<Which>('merged') },
      ),
      anchored: fc.boolean(),
      closes: fc.option(repo, { nil: null }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ kind: fc.constant('pr-opened' as const), repo }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('pr-closed' as const), repo }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('pr-reopened' as const), repo }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'hook-failed' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'run-dropped' as const }) },
);

const REFUSALS = [
  InvalidTaskTransitionError,
  StaleTaskRevisionError,
  MoveDeniedError,
  TaskOnHoldError,
  AssignedToAnotherPersonError,
  NotOnTheTeamAskedError,
  InvalidApprovalAnswerError,
];

const refused = (error: unknown): boolean =>
  REFUSALS.some((type) => error instanceof type);

interface World {
  task: Task;
  now: Date;
  runs: number;
  holds: number;
  readonly revisionOf: Map<string, number>;
  readonly stationOf: Map<string, StationId>;
  readonly attempts: Map<string, number>;
  lastRun: RunId | null;
}

const RANK = TaskRank.of('i');

const placements: TaskPlacementsPort = { placementsAt: async () => [] };
const facts: RunFactsPort = { of: async () => [] };

const servicesOf = (world: World) => {
  const clock: ClockPort = { now: () => world.now, sleep: async () => {} };
  const dispatch: TaskDispatching = {
    runIdFor: async () => RunId.of(`run_${++world.runs}`),
  };

  return {
    dispatch,
    routing: new RunRouting(placements, dispatch, clock),
    resuming: new LineResuming(placements, facts, dispatch, clock),
  };
};

type Services = ReturnType<typeof servicesOf>;

const said = (world: World, body: string, voice: Voice) => ({
  line: LINE,
  body: TaskNoteBody.of(body),
  at: world.now,
  voice,
});

const staleRun = RunId.of('run_stale');

const runOf = (world: World, stale: boolean): RunId | null =>
  stale ? staleRun : world.task.currentRunId;

const handoverOf = (task: Task, ending: Ending, choice: number) => {
  const here = LINE.stationAt(task.stationId);
  const routes = here?.passesTo ?? [];
  const body = TaskNoteBody.of('Uploads retry now.');

  switch (ending) {
    case 'done':
      return here?.ends
        ? ResolvedHandover.done(body)
        : ResolvedHandover.review(body);
    case 'review':
      return ResolvedHandover.review(body);
    case 'failed':
      return ResolvedHandover.failed(body, TaskFailure.fromRun('runner-lost'));
    case 'pass': {
      const to = routes[choice % Math.max(routes.length, 1)];

      return to
        ? ResolvedHandover.pass(to, body)
        : ResolvedHandover.review(body);
    }
  }
};

const payloadOf = (which: Which, closes: Repo | null): HappeningPayload => ({
  happening: Happening.of(HAPPENINGS[which]),
  summary: `The pull request was ${which}.`,
  answers: ANSWERING.includes(which),
  state: 'raised',
  closedPullRequest:
    which === 'merged' && closes ? PULL_REQUESTS[closes] : null,
});

const actorOf = (task: Task, by: Actor): UserId =>
  by === 'holder' ? (task.openHold?.by ?? PEOPLE.leon) : PEOPLE[by];

const askingApproval = (task: Task, run: RunId, of: UserId | null, at: Date) =>
  task.clearFor(
    ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
    ),
    ApprovalNeeded.of('linear.comment', 'It posts publicly.', of),
    {
      line: LINE,
      body: TaskNoteBody.of('Approve linear.comment?'),
      at,
      voice: Voice.station(run),
    },
    run,
    null,
  ).task;

const connectionOf = (of: UserId) =>
  ConnectionAsk.of({
    teamId: TEAM_ID,
    integration: LINEAR,
    providedBy: 'Linear',
    personId: of,
  });

const openFrom = (task: Task): NotePosition =>
  task.openConversation?.from ?? NotePosition.of(0);

const runEnded = async (
  world: World,
  services: Services,
  each: Extract<Step, { kind: 'run-ends' }>,
): Promise<Task> => {
  const run = runOf(world, each.stale);

  if (!run) {
    throw new InvalidTaskTransitionError('No run works on the task.');
  }

  return services.routing.routed(
    handoverOf(world.task, each.ending, each.pick),
    world.task,
    LINE,
    run,
  );
};

const turnKept = (world: World, stale: boolean): Task => {
  const run = runOf(world, stale);

  if (!run) {
    throw new InvalidTaskTransitionError('No run works on the task.');
  }

  const attempt = (world.attempts.get(run.value) ?? 0) + 1;
  world.attempts.set(run.value, attempt);

  return world.task.awaitTurn({
    turn: AwaitedTurn.of(run, attempt),
    note: said(world, 'Which queue should I drain?', Voice.station(run)),
    session: HarnessSession.of(`session_${run.value}`),
    runner: RunnerId.of('runner_1'),
  });
};

const answered = async (
  world: World,
  services: Services,
  each: Extract<Step, { kind: 'answer' }>,
): Promise<Task> => {
  const task = world.task;
  const from = openFrom(task);
  const approval = from.noteIn(task.notes)?.approval ?? null;
  const decision = approval ? (each.approve ? 'approved' : 'dismissed') : null;

  return handedToRun(
    services.dispatch,
    task.answerAs(
      PEOPLE[each.by],
      TEAM,
      from,
      said(world, 'Drain the upload queue.', Voice.person(PEOPLE[each.by])),
      decision,
    ),
    LINE,
  );
};

const messaged = async (
  world: World,
  services: Services,
  by: Person,
): Promise<Task> => {
  const task = world.task;
  const run = task.currentRunId ?? world.lastRun;

  if (!run) {
    throw new InvalidTaskTransitionError('No run of the task to message.');
  }

  const at = world.stationOf.get(run.value) ?? null;
  const note = said(world, 'Use a bounded queue.', Voice.person(PEOPLE[by]));
  const received = task.holdsOnMessage(run, note.voice, at, LINE)
    ? task
        .hold({
          id: HoldId.of(`hold_${++world.holds}`),
          by: PEOPLE[by],
          members: TEAM,
          line: LINE,
          currentRunStarted: true,
          at: world.now,
        })
        .addMessage(note, at)
    : task.receiveMessage(run, note, at, TEAM);

  return handedToRun(services.dispatch, received, LINE);
};

const resumed = (
  world: World,
  services: Services,
  each: Extract<Step, { kind: 'resume' }>,
): Promise<Task> => {
  const here = LINE.stationAt(world.task.stationId);
  const routes = here?.passesTo ?? [];

  return services.resuming.resumed(world.task, LINE, {
    by: actorOf(world.task, each.by),
    next: each.next,
    to:
      each.next === 'move-on'
        ? (routes[each.pick % Math.max(routes.length, 1)] ?? null)
        : null,
    verdict: null,
    summary: 'Kept the queue bounded.',
    endingTurn: null,
  });
};

const moved = async (
  world: World,
  services: Services,
  each: Extract<Step, { kind: 'move' }>,
): Promise<Task> => {
  const current = world.task.revision.value;
  const seen = each.stale && current > 0 ? current - 1 : current;
  const task = world.task.assertRevision(TaskRevision.of(seen));
  const to = stationAt(each.to);
  const placed = task.placeAt(
    LINE,
    to.id,
    RANK,
    {
      line: LINE,
      body: TaskNoteBody.movedTo(to.name),
      at: world.now,
      voice: Voice.station(),
    },
    { mover: actorOf(world.task, each.by) },
  );

  return placed.moved
    ? handedToRun(services.dispatch, placed.task, LINE)
    : placed.task;
};

const reacted = async (
  world: World,
  services: Services,
  each: Extract<Step, { kind: 'happening' }>,
): Promise<Task> => {
  const task = world.task;
  const payload = payloadOf(each.which, each.closes);
  const outcome = ReactionFor.happened({
    task,
    line: LINE,
    payload,
    anchor: each.anchored ? Anchor.of({ body: 'Rename it.' }) : null,
  });
  const updated = task.reactTo(outcome, {
    at: world.now,
    voice: Voice.fromHappening(payload.happening),
    members: TEAM,
    attachments: [],
    ranksAtDestination: [],
  });

  return updated ? handedToRun(services.dispatch, updated, LINE) : task;
};

const prClosed = async (
  world: World,
  services: Services,
  url: PullRequestUrl,
): Promise<Task> => {
  const task = world.task;
  const closed = task.pullRequestClosed(url, world.now, {
    line: task.moveHeldTo ? LINE : null,
    ranksAtHeldMove: [],
  });

  return task.moveHeldTo && !closed.stationId.equals(task.stationId)
    ? handedToRun(services.dispatch, closed, LINE)
    : closed;
};

const hookFailed = async (world: World, services: Services): Promise<Task> => {
  const task = world.task;

  if (task.supersedesHookFailureAt(task.stationId)) {
    return task;
  }

  return handedToRun(
    services.dispatch,
    task.failed(
      TaskFailure.fromHook('core/notify', 'rejected'),
      said(world, 'The hook rejected the run.', Voice.station()),
      null,
      LINE,
      task.deferredMoveTo ? Placement.entering('deferred', []) : null,
    ),
    LINE,
  );
};

const applied = async (world: World, each: Step): Promise<Task> => {
  const services = servicesOf(world);
  const task = world.task;

  switch (each.kind) {
    case 'dispatch':
      return handedToRun(services.dispatch, task, LINE);
    case 'stray-assign':
      return task.assignRun(RunId.of(`run_${++world.runs}`), LINE);
    case 'assign':
      return each.to ? task.assign(PEOPLE[each.to], TEAM) : task.unassign();
    case 'run-ends':
      return runEnded(world, services, each);
    case 'turn-kept':
      return turnKept(world, each.stale);
    case 'ask-approval': {
      const run = task.currentRunId;

      return run
        ? askingApproval(task, run, each.of ? PEOPLE[each.of] : null, world.now)
        : task;
    }
    case 'ask-connection': {
      const run = task.currentRunId;

      return run
        ? task.askToConnect(
            run,
            said(world, 'Connect Linear.', Voice.station(run)),
            connectionOf(PEOPLE[each.of]),
          ).task
        : task;
    }
    case 'connected':
      return (
        task.connectionMade(TEAM_ID, LINEAR, PEOPLE[each.by], {
          line: LINE,
          at: world.now,
        }) ?? task
      );
    case 'answer':
      return answered(world, services, each);
    case 'resolve':
      return task.resolveAs(
        PEOPLE[each.by],
        TEAM,
        openFrom(task),
        said(world, 'Resolved.', Voice.person(PEOPLE[each.by])),
      );
    case 'message':
      return messaged(world, services, each.by);
    case 'resume':
      return resumed(world, services, each);
    case 'move':
      return moved(world, services, each);
    case 'happening':
      return reacted(world, services, each);
    case 'pr-opened': {
      const run = task.currentRunId;

      return run
        ? task.recordPullRequest(run, PULL_REQUESTS[each.repo], world.now, LINE)
        : task;
    }
    case 'pr-closed':
      return prClosed(world, services, PULL_REQUESTS[each.repo]);
    case 'pr-reopened':
      return task.pullRequestReopened(PULL_REQUESTS[each.repo]);
    case 'hook-failed':
      return hookFailed(world, services);
    case 'run-dropped': {
      const run = task.currentRunId;

      return run ? task.dropUnstartedRun(run) : task;
    }
    case 'delete':
      return task.deleted();
  }
};

interface Visit {
  readonly before: Task;
  readonly after: Task;
  readonly step: Step;
  readonly accepted: boolean;
  readonly events: readonly DomainEvent[];
  readonly revisionOfRun: number | null;
}

const assignedIn = (events: readonly DomainEvent[]): readonly RunId[] =>
  events.flatMap((event) =>
    event instanceof TaskRunAssigned ? [event.runId] : [],
  );

const opened = (start: Key): Task => {
  const task = Task.add({
    line: LINE,
    at: stationAt(start).id,
    title: TaskTitle.of('Retry uploads'),
    rank: RANK,
    createdBy: PEOPLE.leon,
    now: START,
    newId: () => 'task_1',
  });

  task.pullEvents();

  return task;
};

const DELETE: Step = { kind: 'delete' };

const walk = async (
  start: Key,
  steps: readonly Step[],
  deletedAtLast: boolean,
): Promise<readonly Visit[]> => {
  const world: World = {
    task: opened(start),
    now: START,
    runs: 0,
    holds: 0,
    revisionOf: new Map(),
    stationOf: new Map(),
    attempts: new Map(),
    lastRun: null,
  };
  const visits: Visit[] = [];

  world.task = await handedToRun(servicesOf(world).dispatch, world.task, LINE);

  const remembered = (task: Task, events: readonly DomainEvent[]) => {
    for (const run of assignedIn(events)) {
      world.revisionOf.set(run.value, task.revision.value);
      world.stationOf.set(run.value, task.stationId);
    }

    world.lastRun = task.currentRunId ?? world.lastRun;
  };

  remembered(world.task, world.task.pullEvents());

  for (const each of deletedAtLast ? [...steps, DELETE] : steps) {
    world.now = new Date(world.now.getTime() + 60_000);

    const before = world.task;
    let accepted = true;

    try {
      world.task = await applied(world, each);
    } catch (error) {
      if (!refused(error)) {
        throw error;
      }
      accepted = false;
    }

    const after = world.task;
    const events = accepted ? after.pullEvents() : [];

    remembered(after, events);

    visits.push({
      before,
      after,
      step: each,
      accepted,
      events,
      revisionOfRun: after.currentRunId
        ? (world.revisionOf.get(after.currentRunId.value) ?? null)
        : null,
    });
  }

  return visits;
};

const start: fc.Arbitrary<Key> = fc.oneof(
  { weight: 2, arbitrary: fc.constant<Key>('backlog') },
  {
    weight: 3,
    arbitrary: fc.constantFrom<Key>(
      'triage',
      'spec',
      'implementation',
      'code-review',
    ),
  },
);

const steps = fc.array(step, { maxLength: 50, size: 'max' });

const RUNS = { numRuns: 1_500 };

const lifecycle = (holds: (visit: Visit) => boolean) =>
  fc.asyncProperty(start, steps, fc.boolean(), async (from, each, deleted) =>
    (await walk(from, each, deleted)).every(holds),
  );

const toldOf = (events: readonly DomainEvent[], run: RunId): boolean =>
  events.some(
    (event) =>
      (event instanceof TaskRunDetached || event instanceof TaskRunEnded) &&
      event.runId.equals(run),
  );

const endedByItsOwnRun = (visit: Visit): boolean =>
  (visit.step.kind === 'run-ends' && !visit.step.stale) ||
  visit.step.kind === 'run-dropped';

const lastAsked = (task: Task) =>
  [...task.notes].reverse().find((note) => note.kind === 'asked') ?? null;

const waitsOnAQuestion = (task: Task): boolean => {
  const asked = lastAsked(task);

  return (
    task.running &&
    task.awaitingReview &&
    asked !== null &&
    asked.approval === null &&
    asked.connectionAsk === null
  );
};

const closedBy = (step: Step): PullRequestUrl | null =>
  step.kind === 'happening' && step.which === 'merged' && step.closes
    ? PULL_REQUESTS[step.closes]
    : null;

const anotherUnsettled = (task: Task, closed: PullRequestUrl): boolean =>
  task.ownedPullRequests.some(
    (each) => !each.settled && !each.url.equals(closed),
  );

const closeRouted = (task: Task, closed: PullRequestUrl): boolean =>
  task.ownedPullRequests.some(
    (each) => each.url.equals(closed) && each.closeRouted,
  );

const keptByAnotherPullRequest = (task: Task, step: Step): boolean => {
  const closed = closedBy(step);

  return (
    closed !== null &&
    (closeRouted(task, closed) || anotherUnsettled(task, closed))
  );
};

const freeToReact = (visit: Visit): boolean =>
  visit.step.kind === 'happening' &&
  !visit.before.stationId.equals(COMPLETED) &&
  !visit.before.onHold &&
  !keptByAnotherPullRequest(visit.before, visit.step);

const movesToReview = (visit: Visit): boolean =>
  visit.step.kind === 'happening' &&
  ANSWERING.includes(visit.step.which) &&
  freeToReact(visit) &&
  !visit.before.stationId.equals(CODE_REVIEW);

const loadable = (task: Task): boolean => {
  try {
    Task.rehydrate({ ...task });
    return true;
  } catch {
    return false;
  }
};

describe('a task under any order of runs, people and happenings on its line', () => {
  it('stays in a state the repository can load back', async () => {
    await fc.assert(
      lifecycle(({ after }) => loadable(after)),
      RUNS,
    );
  });

  it('stands at one station of its line, finished whenever that station is completed', async () => {
    await fc.assert(
      lifecycle(
        ({ after }) =>
          LINE.stationAt(after.stationId) !== null &&
          (!after.stationId.equals(COMPLETED) || after.finished),
      ),
      RUNS,
    );
  });

  it('takes a new run only once the run before it has ended or been let go', async () => {
    await fc.assert(
      lifecycle((visit) => {
        const assigned = assignedIn(visit.events);
        const held = visit.before.currentRunId;

        return (
          assigned.length <= 1 &&
          (assigned.length === 0 ||
            held === null ||
            toldOf(visit.events, held) ||
            endedByItsOwnRun(visit))
        );
      }),
      RUNS,
    );
  });

  it('never lets go of a run without telling it, unless that run ended itself', async () => {
    await fc.assert(
      lifecycle((visit) => {
        const held = visit.before.currentRunId;

        return (
          held === null ||
          visit.after.hasCurrentRun(held) ||
          toldOf(visit.events, held) ||
          endedByItsOwnRun(visit)
        );
      }),
      RUNS,
    );
  });

  it('keeps the revision its current run was dispatched at', async () => {
    await fc.assert(
      lifecycle(
        ({ after, revisionOfRun }) =>
          after.currentRunId === null || revisionOfRun === after.revision.value,
      ),
      RUNS,
    );
  });

  it('takes a new revision exactly when it moves or finishes', async () => {
    await fc.assert(
      lifecycle(({ before, after }) => {
        const added = after.revision.value - before.revision.value;
        const movedOrFinished =
          !after.stationId.equals(before.stationId) ||
          (!before.finished && after.finished);

        return added === (movedOrFinished ? 1 : 0);
      }),
      RUNS,
    );
  });

  it('never moves or runs again once it reaches the completed station', async () => {
    await fc.assert(
      lifecycle(
        ({ before, after, events }) =>
          !before.stationId.equals(COMPLETED) ||
          (after.stationId.equals(COMPLETED) &&
            after.finished &&
            after.currentRunId === null &&
            assignedIn(events).length === 0),
      ),
      RUNS,
    );
  });

  it('waits on nobody and runs nothing while it is finished', async () => {
    await fc.assert(
      lifecycle(
        ({ after }) =>
          !after.finished || (!after.running && !after.awaitingReview),
      ),
      RUNS,
    );
  });

  it('reacts to every happening without a refusal', async () => {
    await fc.assert(
      lifecycle(
        ({ step: each, accepted }) => each.kind !== 'happening' || accepted,
      ),
      RUNS,
    );
  });

  it('finishes when its pull request merges, even while a run works on it', async () => {
    await fc.assert(
      lifecycle((visit) => {
        const { step: each, before, after, accepted } = visit;

        return (
          each.kind !== 'happening' ||
          each.which !== 'merged' ||
          !freeToReact(visit) ||
          (accepted &&
            after.stationId.equals(COMPLETED) &&
            after.finished &&
            after.currentRunId === null &&
            !after.awaitingReview &&
            (before.currentRunId === null ||
              toldOf(visit.events, before.currentRunId)))
        );
      }),
      RUNS,
    );
  });

  it('holds the move of a merge while another of its pull requests is still open', async () => {
    await fc.assert(
      lifecycle(({ before, after, step: each }) => {
        const closed = closedBy(each);

        return (
          closed === null ||
          before.stationId.equals(COMPLETED) ||
          before.onHold ||
          closeRouted(before, closed) ||
          !anotherUnsettled(before, closed) ||
          (after.stationId.equals(before.stationId) &&
            (after.moveHeldTo?.equals(COMPLETED) ?? false))
        );
      }),
      RUNS,
    );
  });

  it('makes the held move once its last pull request closes', async () => {
    await fc.assert(
      lifecycle(({ before, after, step: each }) => {
        const to = before.moveHeldTo;

        return (
          each.kind !== 'pr-closed' ||
          to === null ||
          after.ownedPullRequests.some((pull) => !pull.settled) ||
          (after.moveHeldTo === null &&
            (after.stationId.equals(to) ||
              (after.deferredMoveTo?.equals(to) ?? false) ||
              (after.openHold?.heldMove?.equals(to) ?? false)))
        );
      }),
      RUNS,
    );
  });

  it('moves at once on a happening unless a run works on it with no question pending', async () => {
    await fc.assert(
      lifecycle((visit) => {
        const { before, after } = visit;
        const atOnce = !before.running || waitsOnAQuestion(before);

        return (
          !movesToReview(visit) ||
          (atOnce
            ? after.stationId.equals(CODE_REVIEW) && !after.awaitingReview
            : after.stationId.equals(before.stationId) &&
              (after.deferredMoveTo?.equals(CODE_REVIEW) ?? false))
        );
      }),
      RUNS,
    );
  });

  it('keeps its station while it is on hold, unless the person holding it moves it on', async () => {
    await fc.assert(
      lifecycle(({ before, after, step: each }) => {
        const holder = before.openHold?.by ?? null;
        const byHolder =
          (each.kind === 'move' || each.kind === 'resume') &&
          holder !== null &&
          actorOf(before, each.by).equals(holder);

        return (
          !before.onHold || byHolder || after.stationId.equals(before.stationId)
        );
      }),
      RUNS,
    );
  });

  it('makes a deferred move when its run ends without passing it on', async () => {
    await fc.assert(
      lifecycle(({ before, after, step: each, accepted }) => {
        const to = before.deferredMoveTo;
        const passes =
          each.kind === 'run-ends' &&
          each.ending === 'pass' &&
          !before.awaitingReview &&
          !after.stationId.equals(before.stationId);

        return (
          each.kind !== 'run-ends' ||
          each.stale ||
          before.currentRunId === null ||
          before.onHold ||
          to === null ||
          passes ||
          (accepted && after.stationId.equals(to))
        );
      }),
      RUNS,
    );
  });

  it('lets a person answer or resolve exactly when the inbox offers it to them', async () => {
    const acting = TeamStanding.of({ seesTeam: true, actsOnTeam: true });

    await fc.assert(
      lifecycle((visit) => {
        if (visit.step.kind !== 'answer' && visit.step.kind !== 'resolve') {
          return true;
        }

        const person = PEOPLE[visit.step.by];
        const standing = visit.before.conversationStandingOf({
          person,
          onTeam: true,
        });
        const offered =
          visit.before.openConversation !== null &&
          (visit.step.kind === 'resolve'
            ? ConversationAudience.mayResolve(acting, standing)
            : ConversationAudience.mayAnswer(acting, standing));
        const approval = visit.before.openConversationNote?.approval ?? null;
        const decidedOnlyBySomeoneElse =
          visit.step.kind === 'answer' &&
          approval !== null &&
          (!approval.open ||
            (visit.step.approve &&
              approval.askedOf !== null &&
              !approval.askedOf.equals(person)));

        return decidedOnlyBySomeoneElse
          ? !visit.accepted || offered
          : visit.accepted === offered;
      }),
      RUNS,
    );
  }, 120_000);

  it('lets only its current run route it, and routes every ending of that run', async () => {
    await fc.assert(
      lifecycle(({ before, after, step: each, accepted }) => {
        const ends = each.kind === 'run-ends' || each.kind === 'turn-kept';
        const stale = ends && each.stale;
        const unchanged =
          after.stationId.equals(before.stationId) &&
          after.notes.length === before.notes.length &&
          after.revision.equals(before.revision) &&
          (after.currentRunId?.value ?? null) ===
            (before.currentRunId?.value ?? null);

        return (
          !ends ||
          before.currentRunId === null ||
          (stale ? !accepted || unchanged : accepted)
        );
      }),
      RUNS,
    );
  });

  it('accepts a hand move only at the revision the person saw', async () => {
    await fc.assert(
      lifecycle(
        ({ before, step: each, accepted }) =>
          each.kind !== 'move' ||
          !accepted ||
          !each.stale ||
          before.revision.value === 0,
      ),
      RUNS,
    );
  });

  it('lets go of its run when it is deleted', async () => {
    await fc.assert(
      lifecycle(
        ({ before, after, step: each, events }) =>
          each.kind !== 'delete' ||
          (after.currentRunId === null &&
            events.some((event) => event instanceof TaskDeleted) &&
            (before.currentRunId === null ||
              toldOf(events, before.currentRunId))),
      ),
      RUNS,
    );
  });
});

describe('a task held by one person whose turn asks another person', () => {
  const heldByMaya = (): Task =>
    opened('implementation')
      .assignRun(RunId.of('run_line'), LINE)
      .hold({
        id: HoldId.of('hold_1'),
        by: PEOPLE.maya,
        members: TEAM,
        line: LINE,
        currentRunStarted: true,
        at: START,
      })
      .addMessage({
        line: LINE,
        body: TaskNoteBody.of('Use a bounded queue.'),
        at: START,
        voice: Voice.person(PEOPLE.maya),
      })
      .assignRun(RunId.of('run_turn'), LINE);

  it('stays loadable when the turn asks the person who opened the task to connect', () => {
    const asked = heldByMaya().askToConnect(
      RunId.of('run_turn'),
      {
        line: LINE,
        body: TaskNoteBody.of('Connect Linear.'),
        at: START,
        voice: Voice.station(RunId.of('run_turn')),
      },
      connectionOf(PEOPLE.leon),
    ).task;

    expect(loadable(asked)).toBe(true);
  });

  it('stays loadable when the turn asks that person to approve a tool call', () => {
    const asked = askingApproval(
      heldByMaya(),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    );

    expect(loadable(asked)).toBe(true);
  });

  it('shows the ask to the person it names, and only while it is open', () => {
    const asked = askingApproval(
      heldByMaya(),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    );
    const approved = asked.answerAs(
      PEOPLE.leon,
      TEAM,
      openFrom(asked),
      {
        line: LINE,
        body: TaskNoteBody.of('Go ahead.'),
        at: START,
        voice: Voice.person(PEOPLE.leon),
      },
      'approved',
    );

    expect(
      asked.conversationStandingOf({ person: PEOPLE.leon, onTeam: true }),
    ).toBe('asked');
    expect(
      asked.conversationStandingOf({ person: PEOPLE.maya, onTeam: true }),
    ).toBe('assignee');
    expect(
      approved.conversationStandingOf({ person: PEOPLE.leon, onTeam: true }),
    ).toBe('following');
  });

  it('lets the person asked connect, and stays with its holder', () => {
    const connected = heldByMaya()
      .askToConnect(
        RunId.of('run_turn'),
        {
          line: LINE,
          body: TaskNoteBody.of('Connect Linear.'),
          at: START,
          voice: Voice.station(RunId.of('run_turn')),
        },
        connectionOf(PEOPLE.leon),
      )
      .task.connectionMade(TEAM_ID, LINEAR, PEOPLE.leon, {
        line: LINE,
        at: START,
      });

    expect(connected?.assignee).toEqual(PEOPLE.maya);
    expect(connected && loadable(connected)).toBe(true);
  });

  it('lets the person asked approve the tool call, and stays with its holder', () => {
    const asked = askingApproval(
      heldByMaya(),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    );
    const approved = asked.answerAs(
      PEOPLE.leon,
      TEAM,
      openFrom(asked),
      {
        line: LINE,
        body: TaskNoteBody.of('Go ahead.'),
        at: START,
        voice: Voice.person(PEOPLE.leon),
      },
      'approved',
    );
    const approval = approved.approvalFor(
      ApprovalSubject.toolCall(
        ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
      ),
    )?.approval;

    expect(approval?.grantedFor(PEOPLE.leon)).toBe(true);
    expect(approved.assignee).toEqual(PEOPLE.maya);
    expect(loadable(approved)).toBe(true);
  });

  it('leaves any further answer to its holder once the person asked has decided', () => {
    const asked = askingApproval(
      heldByMaya(),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    );
    const words = {
      line: LINE,
      body: TaskNoteBody.of('Also drain the queue.'),
      at: START,
      voice: Voice.person(PEOPLE.leon),
    };
    const approved = asked.answerAs(
      PEOPLE.leon,
      TEAM,
      openFrom(asked),
      { ...words, body: TaskNoteBody.of('Go ahead.') },
      'approved',
    );

    expect(() =>
      approved.answerAs(PEOPLE.leon, TEAM, openFrom(approved), words),
    ).toThrow(AssignedToAnotherPersonError);
  });

  it('leaves the answer to its holder when the ask names another person', () => {
    const asked = askingApproval(
      heldByMaya(),
      RunId.of('run_turn'),
      PEOPLE.maya,
      START,
    );

    expect(() =>
      asked.answerAs(
        PEOPLE.leon,
        TEAM,
        openFrom(asked),
        {
          line: LINE,
          body: TaskNoteBody.of('Go ahead.'),
          at: START,
          voice: Voice.person(PEOPLE.leon),
        },
        'approved',
      ),
    ).toThrow(AssignedToAnotherPersonError);
  });

  it('leaves the answer to its holder once the person asked has connected', () => {
    const asked = heldByMaya().askToConnect(
      RunId.of('run_turn'),
      {
        line: LINE,
        body: TaskNoteBody.of('Connect Linear.'),
        at: START,
        voice: Voice.station(RunId.of('run_turn')),
      },
      connectionOf(PEOPLE.leon),
    ).task;
    const connected = asked.connectionMade(TEAM_ID, LINEAR, PEOPLE.leon, {
      line: LINE,
      at: START,
    });

    if (!connected?.openConversation) {
      throw new Error('the connection closed the conversation');
    }

    expect(() =>
      connected.answerAs(PEOPLE.leon, TEAM, openFrom(connected), {
        line: LINE,
        body: TaskNoteBody.of('Done.'),
        at: START,
        voice: Voice.person(PEOPLE.leon),
      }),
    ).toThrow(AssignedToAnotherPersonError);
  });

  it('lets the person asked still approve after the task moves to someone else, when it is not on hold', () => {
    const asked = askingApproval(
      opened('implementation').assignRun(RunId.of('run_turn'), LINE),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    );
    const moved = asked.assign(PEOPLE.maya, TEAM);
    const approved = moved.answerAs(
      PEOPLE.leon,
      TEAM,
      openFrom(moved),
      {
        line: LINE,
        body: TaskNoteBody.of('Go ahead.'),
        at: START,
        voice: Voice.person(PEOPLE.leon),
      },
      'approved',
    );

    expect(asked.assignee).toEqual(PEOPLE.leon);
    expect(
      moved.conversationStandingOf({ person: PEOPLE.leon, onTeam: true }),
    ).toBe('asked');
    expect(approved.assignee).toEqual(PEOPLE.maya);
    expect(loadable(approved)).toBe(true);
  });
});

describe('a task unassigned while its turn asks a person on its team', () => {
  const asked = (): Task =>
    askingApproval(
      opened('implementation').assignRun(RunId.of('run_turn'), LINE),
      RunId.of('run_turn'),
      PEOPLE.leon,
      START,
    ).unassign();
  const note = (body: string) => ({
    line: LINE,
    body: TaskNoteBody.of(body),
    at: START,
    voice: Voice.person(PEOPLE.leon),
  });

  it('gives the person asked the team standing, so they may resolve it', () => {
    const task = asked();

    expect(task.assignee).toBeNull();
    expect(
      task.conversationStandingOf({ person: PEOPLE.leon, onTeam: true }),
    ).toBe('team');
  });

  it('assigns the person asked when they resolve it', () => {
    const task = asked();
    const resolved = task.resolveAs(
      PEOPLE.leon,
      TEAM,
      openFrom(task),
      note('Not needed.'),
    );

    expect(resolved.assignee).toEqual(PEOPLE.leon);
    expect(resolved.openConversation).toBeNull();
  });

  it('assigns the person asked when they answer in words', () => {
    const task = asked();
    const answered = task.answerAs(
      PEOPLE.leon,
      TEAM,
      openFrom(task),
      note('Use the staging key.'),
    );

    expect(answered.assignee).toEqual(PEOPLE.leon);
    expect(loadable(answered)).toBe(true);
  });
});
