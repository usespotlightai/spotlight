import { TakeUpStandingWork } from '@application/services/take-up-standing-work.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const at = (name: string, harness = HarnessId.of('dev')) =>
  Station.create({
    id: StationId.of('station_1'),
    name: StationName.of(name),
    position: 1,
    color: StationColor.of('#a3a8b0'),
    harness,
  });

const worked = at('Triage');
// A station of its own: two sharing an id would make the line ambiguous
// about which one it holds.
const nobody = Station.create({
  id: StationId.of('station_0'),
  name: StationName.of('Backlog'),
  position: 0,
  color: StationColor.of('#a3a8b0'),
});

const waiting = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-28T12:00:00.000Z'),
    newId: () => 'task_1',
  });

let standing: Task[] = [];
let saved: Task[] = [];

const tasks = {
  standingAt: vi.fn(async () => standing),
  placementsAt: vi.fn(async () => []),
  withPullRequest: vi.fn(async () => null),
  save: vi.fn(async (task: Task) => {
    saved.push(task);
  }),
} as unknown as TaskRepository;

const dispatched = vi.fn(async () => RunId.of('run_1'));
const dispatch = { dispatch: dispatched } as unknown as TaskDispatching;

const ends = (id: string, name: string, position: number) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    kind: position === 0 ? 'backlog' : 'completed',
  });

const takeUp = (station: Station) =>
  new TakeUpStandingWork(tasks, dispatch).takeUp({
    line: AssemblyLine.of({
      id: AssemblyLineId.of('line_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      factoryId: FactoryId.of('factory_1'),
      name: AssemblyLineName.of('Default'),
      stations: [
        ends('backlog_1', 'Backlog', 0),
        station.movedTo(1),
        ends('completed_1', 'Completed', 2),
      ],
    }),
    stationId: station.id,
  });

describe('TakeUpStandingWork', () => {
  beforeEach(() => {
    standing = [waiting()];
    saved = [];
    dispatched.mockClear();
  });

  it('starts the work standing at a station that can work it', async () => {
    await takeUp(worked);

    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(saved[0]?.currentRunId?.value).toBe('run_1');
  });

  // A station nothing works holds what it is given, which is what a backlog is.
  it('starts nothing at a station nothing works', async () => {
    await takeUp(nobody);

    expect(dispatched).not.toHaveBeenCalled();
  });

  it('leaves a task that is already running to its run', async () => {
    standing = [waiting().handedTo(RunId.of('run_already'))];

    await takeUp(worked);

    expect(dispatched).not.toHaveBeenCalled();
  });

  // Waiting on a person is not idle: starting it again would talk over them.
  it('leaves a task waiting on a person alone', async () => {
    standing = [
      waiting().askedAbout(
        TaskNote.of({
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Which queue did you mean?'),
          at: new Date('2026-08-28T12:00:00.000Z'),
          kind: 'passed',
        }),
      ),
    ];

    await takeUp(worked);

    expect(dispatched).not.toHaveBeenCalled();
  });

  it('records the run against each task it starts', async () => {
    await takeUp(worked);

    expect(saved).toHaveLength(1);
  });
});
