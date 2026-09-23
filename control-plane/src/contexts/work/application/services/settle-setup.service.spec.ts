import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SettleSetup } from '@work/application/services/settle-setup.service';
import { listed } from '@work/application/services/setup-steps';
import type {
  TeamFacts,
  TeamSetup,
} from '@work/application/services/team-setup.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
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
    saying: TaskNoteBody.of(listed({ slug: 'acme', teamId: TEAM.value })),
    at: STATION,
    station: StationName.of('Inbox'),
    owner: OWNER,
    now: new Date('2026-01-01T00:00:00.000Z'),
    newId: nextId,
  });

const done: TeamFacts = {
  hasRunner: true,
  connectedToGitHub: true,
  listening: ['linear'],
};

const settling = (given: { task?: Task; facts?: TeamFacts } = {}) => {
  const task = given.task ?? list();
  const save = vi.fn(async () => {});

  const tasks = {
    save,
    settingUpFor: vi.fn(async () => task),
    settingUpIn: vi.fn(async () => [task]),
    settingUp: vi.fn(async () => [task]),
  } as unknown as TaskRepository;

  const lines = {
    holding: vi.fn(async () => DELIVERY),
  } as unknown as LineRepository;

  const setup = {
    factsFor: vi.fn(async () => given.facts ?? done),
  } as unknown as TeamSetup;

  const logger = { warn: vi.fn(), error: vi.fn() } as unknown as LoggerPort;

  return {
    save,
    tasks,
    logger,
    setup,
    service: new SettleSetup(
      tasks,
      lines,
      setup,
      { now: () => NOW } as ClockPort,
      logger,
    ),
  };
};

const settled = (save: ReturnType<typeof vi.fn>): Task =>
  save.mock.calls[0]?.[0] as Task;

beforeEach(() => {
  ids = 0;
});

describe('SettleSetup', () => {
  it('settles the list once nothing is left on it', async () => {
    const { service, save } = settling();

    await service.forTeam(TEAM);

    const task = settled(save);
    expect(task.notes[task.notes.length - 1]?.kind).toBe('passed');
  });

  it('leaves the task otherwise exactly as it stands', async () => {
    const working = Task.rehydrate({
      ...list(),
      currentRunId: RunId.of('123e4567-e89b-42d3-a456-426614174009'),
    });
    const { service, save } = settling({ task: working });

    await service.forTeam(TEAM);

    expect(settled(save).finishedAt).toBeNull();
    expect(settled(save).currentRunId).toEqual(working.currentRunId);
  });

  it('says so on the trail in the board’s own voice', async () => {
    const { service, save } = settling();

    await service.forTeam(TEAM);

    const last = settled(save).notes[settled(save).notes.length - 1];
    expect(last?.voice.isStation).toBe(true);
    expect(last?.station).toEqual(StationName.of('Inbox'));
    expect(last?.body).toEqual(
      TaskNoteBody.of('Everything on this list is done.'),
    );
  });

  it('leaves it standing while a step is still to be taken', async () => {
    const { service, save } = settling({
      facts: { ...done, hasRunner: false },
    });

    await service.forTeam(TEAM);

    expect(save).not.toHaveBeenCalled();
  });

  it('leaves a conversation somebody else closed alone', async () => {
    const gone = list().settled({
      station: StationName.of('Inbox'),
      body: TaskNoteBody.of('Done here.'),
      at: NOW,
      voice: Voice.station(),
    });

    const { service, save } = settling({ task: gone });

    await service.forTeam(TEAM);

    expect(save).not.toHaveBeenCalled();
  });

  it('goes through every list still standing', async () => {
    const { service, tasks, save } = settling();

    await service.wherever();

    expect(tasks.settingUp).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('asks after the team whose line the list stands on', async () => {
    const { service, setup } = settling();

    await service.wherever();

    expect(setup.factsFor).toHaveBeenCalledWith(WORKSPACE, TEAM);
  });

  it('goes through the lists of one workspace alone', async () => {
    const { service, tasks, save } = settling();

    await service.forWorkspace(WORKSPACE);

    expect(tasks.settingUpIn).toHaveBeenCalledWith(WORKSPACE);
    expect(tasks.settingUp).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('says so and carries on where the lists cannot be looked for', async () => {
    const { service, tasks, logger } = settling();
    (tasks.settingUpFor as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    await expect(service.forTeam(TEAM)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('says so and carries on where a list will not settle', async () => {
    const { service, tasks, logger } = settling();
    (tasks.save as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    await expect(service.forTeam(TEAM)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
