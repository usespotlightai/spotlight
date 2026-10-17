import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import { listed } from '@work/application/services/setup-steps';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { SetupState } from '@work/domain/services/setup-list';
import { welcomeTask } from '@work/domain/services/welcome-task';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('123e4567-e89b-42d3-a456-426614174000');
const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');
const STATION = StationId.of('123e4567-e89b-42d3-a456-426614174002');
const OWNER = UserId.of('123e4567-e89b-42d3-a456-426614174003');
const NOW = new Date('2026-01-02T03:04:05.000Z');

let ids = 0;

const nextId = (): string => {
  ids = (ids + 1) % 10;
  return `123e4567-e89b-42d3-a456-42661417400${ids}`;
};

const DELIVERY = Line.rehydrate({
  id: LineId.of('123e4567-e89b-42d3-a456-426614174004'),
  workspaceId: WORKSPACE,
  teamId: TEAM,
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    Station.of({
      id: STATION,
      key: StationKey.of('inbox'),
      name: StationName.of('Inbox'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('123e4567-e89b-42d3-a456-426614174005'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

const list = (): Task =>
  welcomeTask({
    line: DELIVERY,
    teamId: TEAM,
    noteBody: TaskNoteBody.of(listed()),
    at: STATION,
    station: StationName.of('Inbox'),
    owner: OWNER,
    now: new Date('2026-01-01T00:00:00.000Z'),
    newId: nextId,
  });

const done: SetupState = {
  connectedToGitHub: true,
  hasHarness: true,
  configured: true,
};

const reconciling = (options: { task?: Task; state?: SetupState } = {}) => {
  const task = options.task ?? list();
  const save = vi.fn(async () => {});

  const tasks = {
    save,
    settingUpIn: vi.fn(async () => [task]),
    settingUp: vi.fn(async () => [task]),
    settingUpFor: vi.fn(async () => task),
  } as unknown as TaskRepository;

  const setup = {
    of: vi.fn(async () => ({ state: options.state ?? done, chat: null })),
  } as unknown as SetupStatus;

  const lines = {
    findByStation: vi.fn(async () => DELIVERY),
  } as unknown as LineRepository;

  const logger = { warn: vi.fn(), error: vi.fn() } as unknown as LoggerPort;

  return {
    save,
    tasks,
    logger,
    setup,
    service: new ReconcileSetup(
      tasks,
      lines,
      setup,
      { now: () => NOW } as ClockPort,
      logger,
    ),
  };
};

const savedTask = (save: ReturnType<typeof vi.fn>): Task =>
  save.mock.calls[0]?.[0] as Task;

beforeEach(() => {
  ids = 0;
});

describe('ReconcileSetup', () => {
  it('closes the list once nothing is left on it', async () => {
    const { service, save } = reconciling();

    await service.forWorkspace(WORKSPACE);

    const task = savedTask(save);
    expect(task.notes[task.notes.length - 1]?.kind).toBe('passed');
  });

  it('leaves the task otherwise exactly as it is', async () => {
    const working = Task.rehydrate({
      ...list(),
      currentRunId: RunId.of('123e4567-e89b-42d3-a456-426614174009'),
    });
    const { service, save } = reconciling({ task: working });

    await service.forWorkspace(WORKSPACE);

    expect(savedTask(save).finishedAt).toBeNull();
    expect(savedTask(save).currentRunId).toEqual(working.currentRunId);
  });

  it('says so on the trail in the board’s own voice', async () => {
    const { service, save } = reconciling();

    await service.forWorkspace(WORKSPACE);

    const last = savedTask(save).notes[savedTask(save).notes.length - 1];
    expect(last?.voice.isStation).toBe(true);
    expect(last?.station).toEqual(StationName.of('Inbox'));
    expect(last?.body).toEqual(
      TaskNoteBody.of('Everything on this list is done.'),
    );
  });

  it('leaves it open while a step is still to be taken', async () => {
    const { service, save } = reconciling({
      state: { ...done, hasHarness: false },
    });

    await service.forWorkspace(WORKSPACE);

    expect(save).not.toHaveBeenCalled();
  });

  it('leaves a conversation somebody else closed alone', async () => {
    const gone = list().closeConversation({
      station: StationName.of('Inbox'),
      body: TaskNoteBody.of('Done here.'),
      at: NOW,
      voice: Voice.station(),
    });

    const { service, save } = reconciling({ task: gone });

    await service.forWorkspace(WORKSPACE);

    expect(save).not.toHaveBeenCalled();
  });

  it('goes through every list that is still open', async () => {
    const { service, tasks, save } = reconciling();

    await service.wherever();

    expect(tasks.settingUp).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reads the workspace the list is in', async () => {
    const { service, setup } = reconciling();

    await service.wherever();

    expect(setup.of).toHaveBeenCalledWith(WORKSPACE, TEAM);
  });

  it('goes through the lists of one workspace alone', async () => {
    const { service, tasks, save } = reconciling();

    await service.forWorkspace(WORKSPACE);

    expect(tasks.settingUpIn).toHaveBeenCalledWith(WORKSPACE);
    expect(tasks.settingUp).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('says so and carries on where the lists cannot be looked for', async () => {
    const { service, tasks, logger } = reconciling();
    (tasks.settingUpIn as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    await expect(service.forWorkspace(WORKSPACE)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('says so and carries on where a list cannot be reconciled', async () => {
    const { service, tasks, logger } = reconciling();
    (tasks.save as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    await expect(service.forWorkspace(WORKSPACE)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('reconciles only the list of the team that the request names', async () => {
    const { service, tasks, save } = reconciling();

    await service.forTeam(TEAM);

    expect(tasks.settingUpFor).toHaveBeenCalledWith(TEAM);
    expect(tasks.settingUpIn).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
