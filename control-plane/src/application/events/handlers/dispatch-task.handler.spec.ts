import { DispatchTask } from '@application/events/handlers/dispatch-task.handler';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { RunRepository } from '@domain/repositories/run.repository';
import { CLAUDE_CODE } from '@domain/value-objects/built-in-harnesses';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');

const at = (id: string, name: string, position: number, harness?: HarnessId) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
  });

const stations = [
  at('station_1', 'Backlog', 0),
  at('station_2', 'Triage', 1, CLAUDE_CODE.id),
  at('station_3', 'Spec', 2, CLAUDE_CODE.id),
];

const task = (stationId: string) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  });

let queued: Run[] = [];

const runs = {
  add: async (run: Run) => {
    queued.push(run);
  },
} as unknown as RunRepository;

const ids: IdGeneratorPort = { generate: () => 'run_1' };

const dispatch = (station: Station) =>
  new DispatchTask(runs, ids).dispatch({
    task: task(station.id.value),
    station,
    stations,
  });

describe('DispatchTask', () => {
  beforeEach(() => {
    queued = [];
  });

  it('queues a run for the harness the station is worked by', async () => {
    const id = await dispatch(stations[1] as Station);

    expect(id?.value).toBe('run_1');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.harness.value).toBe(CLAUDE_CODE.id.value);
  });

  // A station naming no harness is how work is held back: the Backlog keeps
  // tasks precisely because nothing works it.
  it('queues nothing for a station nothing works', async () => {
    expect(await dispatch(stations[0] as Station)).toBeNull();
    expect(queued).toHaveLength(0);
  });

  // Queueing for a harness Spotlight cannot start would strand the task on
  // the queue instead of at the station, where a person can see it.
  it('queues nothing for a harness it no longer knows', async () => {
    const station = at('station_9', 'Odd', 1, HarnessId.of('long-gone'));

    expect(await dispatch(station)).toBeNull();
    expect(queued).toHaveLength(0);
  });

  // Downstream first, so a task already under way finishes before another is
  // started behind it.
  it('gives a run the standing of the station it serves', async () => {
    await dispatch(stations[2] as Station);

    expect(queued[0]?.priority).toBe(2);
  });

  // The runner refuses a word that is not on this list, so it has to hold
  // every station the briefing offers, and a person besides.
  it('tells the runner what the agent may hand over to', async () => {
    await dispatch(stations[1] as Station);

    expect(queued[0]?.spec).toMatchObject({
      handover: { options: ['Backlog', 'Spec', 'review'] },
    });
  });

  // Handing a task back to where it stands moves nothing and starts the same
  // work again. The runner refuses the word, so the agent is told at once.
  it('does not let the agent hand the task to its own station', async () => {
    await dispatch(stations[1] as Station);

    const spec = queued[0]?.spec as { handover: { options: string[] } };

    expect(spec.handover.options).not.toContain('Triage');
  });

  // Nobody is watching a station run, so a harness that stops to ask hands
  // nothing over. Which flag buys that differs by harness, and every argument
  // the harness carries reaches the runner ahead of the briefing.
  it('runs the harness the way the harness has to be run', async () => {
    await dispatch(stations[1] as Station);

    const spec = queued[0]?.spec as { command: { executable: string; args: string[] } };

    expect(spec.command.executable).toBe(CLAUDE_CODE.command.executable);
    expect(spec.command.args.slice(0, -1)).toEqual([
      ...CLAUDE_CODE.command.args,
    ]);
  });

  it('briefs the agent in the same words it gives the runner', async () => {
    await dispatch(stations[1] as Station);

    const spec = queued[0]?.spec as {
      command: { args: string[] };
      handover: { options: string[] };
    };

    const brief = spec.command.args[spec.command.args.length - 1] as string;

    for (const option of spec.handover.options) {
      expect(brief).toContain(`"${option}"`);
    }
  });
});
