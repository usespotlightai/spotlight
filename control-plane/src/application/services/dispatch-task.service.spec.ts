import {
  RunSpecContract,
  type RunSpecShape,
} from '@application/contracts/run-spec.contract';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { DispatchTask } from '@application/services/dispatch-task.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Harness } from '@domain/entities/harness.entity';
import { Station } from '@domain/entities/station.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');

const written = (run?: Run): RunSpecShape =>
  RunSpecContract.from(run?.spec.value) as RunSpecShape;

const DEV = Harness.of({
  id: HarnessId.of('dev'),
  name: HarnessName.of('Dev'),
  command: HarnessCommand.of({ executable: 'dev-agent', args: ['--acp'] }),
});

const harnesses: HarnessRepository = {
  all: () => [DEV],
  named: (id: HarnessId) => (id.equals(DEV.id) ? DEV : null),
};

const at = (
  id: string,
  name: string,
  position: number,
  harness?: HarnessId,
  passesTo: string[] = [],
) =>
  Station.of({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    wayOut: WayOut.of({ stations: passesTo.map(StationId.of) }),
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
  });

const stations = [
  at('station_1', 'Backlog', 0),
  at('station_2', 'Triage', 1, DEV.id, ['station_3']),
  at('station_3', 'Spec', 2, DEV.id),
  at('station_4', 'Completed', 3),
];

const task = (stationId: string, repository?: string) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
    repository: repository ? Repository.of(repository) : null,
  });

let queued: Run[] = [];

const runs = {
  add: async (run: Run) => {
    queued.push(run);
  },
} as unknown as RunRepository;

const ids: IdGeneratorPort = { generate: () => 'run_1' };

const held = (changed?: Station) =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: changed
      ? stations.map((each) => (each.equals(changed) ? changed : each))
      : stations,
  });

const tracing = {
  for: (taskId: { value: string }, runId: { value: string }) =>
    `trace:${taskId.value}:${runId.value}`,
};

const dispatch = (station: Station, standing?: Task) =>
  new DispatchTask(runs, ids, harnesses, tracing).dispatch({
    task: standing ?? task(station.id.value),
    line: held(station),
  });

describe('DispatchTask', () => {
  beforeEach(() => {
    queued = [];
  });

  describe('the codebase a run works in', () => {
    // The runner resolves this to an address of its own. A remote that
    // reached GitHub would need a credential written down beside it.
    it('names the repository through Spotlight, never GitHub', async () => {
      const station = stations[1] as Station;

      await dispatch(station, task(station.id.value, 'acme/widgets'));

      expect(written(queued[0]).checkouts).toEqual([
        {
          remote: 'spotlight:repository',
          path: 'widgets',
          branch: 'spotlight/task_1',
        },
      ]);
    });

    it('asks for no checkout where the task names no repository', async () => {
      await dispatch(stations[1] as Station);

      expect(written(queued[0]).checkouts).toBeUndefined();
    });
  });

  it('queues a run for the harness the station is worked by', async () => {
    const id = await dispatch(stations[1] as Station);

    expect(id?.value).toBe('run_1');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.harness.value).toBe(DEV.id.value);
  });

  // A station naming no harness is how work is held back: the Backlog keeps
  // tasks precisely because nothing works it.
  // The runner raises only what the run was handed, so a station's tools
  // have to reach the spec or the agent is told about something that is not
  // there to reach.
  it('hands the run what its station may reach for', async () => {
    await dispatch((stations[1] as Station).reaches([Tool.of('pull-request')]));

    expect(queued[0]?.spec.value).toMatchObject({ tools: ['pull-request'] });
  });

  it('hands a station with no tools none', async () => {
    await dispatch(stations[1] as Station);

    expect(queued[0]?.spec.value).toMatchObject({ tools: [] });
  });

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

    expect(queued[0]?.priority.value).toBe(2);
  });

  // The runner refuses a word that is not on this list, so it has to hold
  // every station the briefing offers, and a person besides.
  it('tells the runner what the agent may hand over to', async () => {
    await dispatch(stations[1] as Station);

    expect(written(queued[0])).toMatchObject({
      handover: { options: ['Spec', 'review'] },
    });
  });

  it('does not offer a station nothing runs at', async () => {
    await dispatch(stations[1] as Station);

    expect(written(queued[0])).toMatchObject({
      handover: { options: expect.not.arrayContaining(['Backlog']) },
    });
  });

  // Handing a task back to where it stands moves nothing and starts the same
  // work again. The runner refuses the word, so the agent is told at once.
  it('does not let the agent hand the task to its own station', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    expect(spec.handover.options).not.toContain('Triage');
  });

  it('runs the harness the way the harness has to be started', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    expect(spec.command.executable).toBe(DEV.command.executable);
    expect(spec.command.args).toEqual([...DEV.command.args]);
  });

  // What to start and what to ask of it are different things: the briefing is
  // put to the agent as a prompt, not smuggled in on a command line.
  it('briefs the agent in the same words it gives the runner', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    for (const option of spec.handover.options) {
      expect(spec.briefing).toContain(`"${option}"`);
    }
  });

  describe('carrying on where the last run stopped', () => {
    const continuityOf = (at: number) => {
      const run = queued[at];
      if (!run) {
        throw new Error(`nothing was queued at ${at}`);
      }
      return written(run).continuity;
    };

    const worked = (station: Station) =>
      task(station.id.value).workedIn(
        HarnessSession.of('session_1'),
        RunnerId.of('runner_1'),
      );

    it('gives the task the same directory for as long as it stands here', async () => {
      const station = stations[1] as Station;

      await dispatch(station);
      await dispatch(station, worked(station));

      expect(continuityOf(0).key).toBe('task_1-station_2');
      expect(continuityOf(1).key).toBe(continuityOf(0).key);
    });

    it('gives it a different one at the next station', async () => {
      await dispatch(stations[1] as Station);
      await dispatch(stations[2] as Station);

      expect(continuityOf(0).key).toBe('task_1-station_2');
      expect(continuityOf(1).key).toBe('task_1-station_3');
    });

    it('keeps the directory, since the conversation lives in it', async () => {
      await dispatch(stations[1] as Station);

      expect(continuityOf(0).keep).toBe(true);
    });

    it('asks for the conversation the task was last worked in', async () => {
      const station = stations[1] as Station;

      await dispatch(station, worked(station));

      expect(continuityOf(0).sessionId).toBe('session_1');
    });

    it('goes back to the runner holding it', async () => {
      const station = stations[1] as Station;

      await dispatch(station, worked(station));

      expect(queued[0]?.targetRunner?.value).toBe('runner_1');
    });

    it('is free to be worked anywhere when there is nothing to resume', async () => {
      const station = stations[1] as Station;

      await dispatch(station);

      expect(queued[0]?.targetRunner).toBeNull();
      expect(continuityOf(0).sessionId).toBeUndefined();
    });
  });
});
