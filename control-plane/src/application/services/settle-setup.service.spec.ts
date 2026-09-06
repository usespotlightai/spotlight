import type { ClockPort } from '@application/ports/clock.port';
import type { LoggerPort } from '@application/ports/logger.port';
import { SettleSetup } from '@application/services/settle-setup.service';
import { listed } from '@application/services/setup-steps';
import type {
  TeamFacts,
  TeamSetup,
} from '@application/services/team-setup.service';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { SetupLists } from '@domain/repositories/task.repository';
import { welcomeTask } from '@domain/services/welcome-task';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
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

const list = (): Task =>
  welcomeTask({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    saying: TaskNoteBody.of(listed({ slug: 'acme', teamId: TEAM.value })),
    stationId: STATION,
    station: StationName.of('Inbox'),
    owner: OWNER,
    now: new Date('2026-01-01T00:00:00.000Z'),
    newId: nextId,
  });

const done: TeamFacts = {
  hasRunner: true,
  connectedToGitHub: true,
  installation: null,
  configRepository: 'acme/spotlight-config',
  hasConfiguration: true,
  listening: ['linear'],
};

const settling = (given: { task?: Task; facts?: TeamFacts } = {}) => {
  const task = given.task ?? list();
  const save = vi.fn(async () => {});

  const tasks = {
    save,
    settingUpFor: vi.fn(async () => ({ teamId: TEAM, task })),
    settingUpIn: vi.fn(async () => [{ teamId: TEAM, task }]),
    settingUp: vi.fn(async () => [{ teamId: TEAM, task }]),
  } as unknown as SetupLists;

  const setup = {
    factsFor: vi.fn(async () => given.facts ?? done),
  } as unknown as TeamSetup;

  const logger = { warn: vi.fn(), error: vi.fn() } as unknown as LoggerPort;

  return {
    save,
    tasks,
    logger,
    service: new SettleSetup(
      tasks,
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

  // Settling is not finishing, and a run that took the task up still holds it.
  it('leaves the task otherwise exactly as it stands', async () => {
    const working = list().handedTo(
      RunId.of('123e4567-e89b-42d3-a456-426614174009'),
    );
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
    const gone = list().finishedHere({
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

  // Whatever brought us here still happened, so nothing here undoes it.
  it('says so and carries on where a list will not settle', async () => {
    const { service, tasks, logger } = settling();
    (tasks.save as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    await expect(service.forTeam(TEAM)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
