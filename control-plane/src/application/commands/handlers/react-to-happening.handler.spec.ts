import { ReactToHappeningHandler } from '@application/commands/handlers/react-to-happening.handler';
import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import type { ClockPort } from '@application/ports/clock.port';
import type { DeliveryLogPort } from '@application/ports/delivery-log.port';
import type {
  Happened,
  RepositoryEventsPort,
} from '@application/ports/repository-events.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { run: async (work) => work() };

const at = (
  id: string,
  name: string,
  position: number,
  reactsTo: Happening[] = [],
  kind: 'backlog' | 'work' | 'completed' = 'work',
) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness: kind === 'work' ? HarnessId.of('dev') : undefined,
    reactsTo,
    kind,
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0, [], 'backlog'),
      at('station_1', 'Implementation', 1, ['changes-requested']),
      at('station_2', 'Code Review', 2, ['commented']),
      at('station_3', 'Completed', 3, ['merged'], 'completed'),
    ],
  });

const standing = (stationId = 'station_2') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

let saved: Task | undefined;
const dispatched: Task[] = [];

const tasks = (found: Task | null) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    withPullRequest: vi.fn(async () => found),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
  }) satisfies AssemblyLineRepository;

const dispatch: TaskDispatching = {
  dispatch: async ({ task }) => {
    dispatched.push(task);
    return RunId.of('run_2');
  },
};

let told: string[] = [];

const heardOf: DeliveryLogPort = {
  claim: async (delivery: string) => {
    const first = !told.includes(delivery);
    told.push(delivery);
    return first;
  },
};

const reading = (happened: Happened | null): RepositoryEventsPort => ({
  read: () => happened,
});

const news = (happening: Happening, said: string | null, ourOwn = false) => ({
  happening,
  concerns: Concerns.of({ branch: 'spotlight/task_1' }) as Concerns,
  said,
  ourOwn,
});

const heard = (
  happening: Happening,
  found: Task | null,
  said: string | null = null,
) =>
  new ReactToHappeningHandler(
    reading(news(happening, said)),
    heardOf,
    tasks(found),
    lines(),
    dispatch,
    transaction,
    clock,
  ).execute(new ReactToHappeningCommand('delivery_1', 'pull_request', {}));

describe('ReactToHappening', () => {
  beforeEach(() => {
    saved = undefined;
    dispatched.length = 0;
    told = [];
  });

  it('takes the task to the station waiting for it', async () => {
    await heard('changes-requested', standing(), 'Handle the empty case.');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
    expect(saved?.notes[0]?.body.value).toContain('Handle the empty case.');
  });

  it('starts the work at the station it was taken to', async () => {
    await heard('changes-requested', standing());

    expect(dispatched).toHaveLength(1);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  // A comment while it stands at review is still news, and still worth a run.
  it('leaves a task where it stands when that is where it belongs', async () => {
    await heard('commented', standing(), 'This retries forever.');

    expect(saved?.stationId).toEqual(StationId.of('station_2'));
    expect(saved?.notes.map((each) => each.kind)).toEqual(['heard']);
    expect(dispatched).toHaveLength(1);
  });

  // The machinery for telling a live agent something already exists: what a
  // person says waits to be delivered, and so does this.
  it('waits to be handed to the agent already working the task', async () => {
    await heard('commented', standing().handedTo(RunId.of('run_1')), 'Look.');

    expect(saved?.undelivered.map((each) => each.kind)).toEqual(['heard']);
  });

  it('says nothing to a station nobody set to wait for it', async () => {
    await heard('checks-failed', standing());

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('leaves a finished task alone', async () => {
    const ended = standing().closed({
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Done.'),
      at: NOW,
    });

    await heard('commented', ended);

    expect(saved).toBeUndefined();
  });

  // A host retries, and a person can ask it to send the same word again.
  it('acts on a delivery once, however often it arrives', async () => {
    await heard('changes-requested', standing());
    saved = undefined;
    await heard('changes-requested', standing());

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(1);
  });

  // Our own comment on our own pull request would start a run that comments
  // again, and so on.
  it('says nothing about what Spotlight itself did', async () => {
    await new ReactToHappeningHandler(
      reading(news('commented', 'Opened by the agent.', true)),
      heardOf,
      tasks(standing()),
      lines(),
      dispatch,
      transaction,
      clock,
    ).execute(new ReactToHappeningCommand('delivery_2', 'issue_comment', {}));

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  // A person is owed an answer, and the world knocking does not settle it.
  it('starts nothing while a person is still owed an answer', async () => {
    const asked = standing().askedAbout({
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Which queue should I drain?'),
      at: NOW,
    });

    await heard('commented', asked, 'Still broken.');

    expect(saved?.notes.map((each) => each.kind)).toEqual(['asked', 'heard']);
    expect(dispatched).toHaveLength(0);
  });

  it('lets a pull request nobody here opened pass', async () => {
    await heard('merged', null);

    expect(saved).toBeUndefined();
  });

  it('starts nothing where a run already holds the task', async () => {
    await heard('commented', standing().handedTo(RunId.of('run_1')));

    expect(dispatched).toHaveLength(0);
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });
});
