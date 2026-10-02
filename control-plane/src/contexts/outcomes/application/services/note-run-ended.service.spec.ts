import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import {
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  SET_UP,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

const TASK = TaskId.of('task_1');

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const endedRun = (runId: string, change: Partial<EndedRun> = {}): EndedRun => ({
  runId,
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: FIRST_CONFIG,
  round: 1,
  ...SET_UP,
  endedAt: at(10),
  ...change,
});

const noting = (runs: readonly EndedRun[]) => {
  const records = new RunRecordsInMemory();
  const forgotten = forgottenInMemory();
  const work: WorkPort = {
    endedRun: async (runId) =>
      runs.find((each) => each.runId === runId) ?? null,
    configsInOrder: async () => [],
    teamRepositories: async () => [],
    teamSkillKeys: async () => [],
    alertsAt: async () => null,
  };

  return {
    records,
    forgotten,
    service: new NoteRunEnded(work, records, forgotten, inTransaction),
    superseding: new NoteRunSuperseded(records, forgotten, inTransaction, {
      now: () => HEARD_AT,
      sleep: async () => {},
    }),
    ended: (runId: string, outcome = 'completed', stopped = false) =>
      new NoteRunEnded(work, records, forgotten, inTransaction).ended({
        runId,
        outcome,
        stopped,
        failure: outcome === 'failed' ? 'exited' : null,
      }),
    stored: async (runId: string) => records.of(RunId.of(runId)),
  };
};

describe('noting that a run ended', () => {
  it('records where it ran, with which config, in which round and how it ended', async () => {
    const noted = noting([endedRun('run_1')]);

    await noted.ended('run_1', 'failed');

    const record = await noted.stored('run_1');
    expect(record?.ending).toBe('failed');
    expect(record?.end?.failure).toBe('exited');
    expect(record?.end?.fingerprint).toBe(FIRST_CONFIG);
    expect(record?.end?.place.stationId).toBe('station_1');
    expect(record?.end?.place.taskId.value).toBe('task_1');
    expect(record?.end?.endedAt).toEqual(at(10));
    expect(record?.end?.round).toBe(1);
  });

  it('records a run a person stopped as stopped', async () => {
    const noted = noting([endedRun('run_1')]);

    await noted.ended('run_1', 'completed', true);

    expect((await noted.stored('run_1'))?.ending).toBe('stopped');
  });

  it('takes the round Work counted for the run', async () => {
    const noted = noting([endedRun('run_1', { round: 3 })]);

    await noted.ended('run_1');

    expect((await noted.stored('run_1'))?.end?.round).toBe(3);
  });

  it('records nothing for a run Work does not know ended at a station', async () => {
    const noted = noting([]);

    await noted.ended('run_1');

    expect(await noted.stored('run_1')).toBeNull();
  });

  it('records nothing for an ending it does not know', async () => {
    const noted = noting([endedRun('run_1')]);

    await noted.ended('run_1', 'exploded');

    expect(await noted.stored('run_1')).toBeNull();
  });

  it('changes nothing when told again that the run ended', async () => {
    const noted = noting([endedRun('run_1')]);
    await noted.ended('run_1');
    const first = await noted.stored('run_1');

    await noted.ended('run_1', 'failed');

    expect(await noted.stored('run_1')).toBe(first);
  });

  it('keeps a superseding heard before the run was heard to end', async () => {
    const noted = noting([endedRun('run_1')]);

    await noted.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await noted.ended('run_1');

    expect((await noted.stored('run_1'))?.ending).toBe('superseded');
  });

  it('marks a recorded run superseded once, however often it is told', async () => {
    const noted = noting([endedRun('run_1')]);
    await noted.ended('run_1');

    await noted.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await noted.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);

    const record = await noted.stored('run_1');
    expect(record?.ending).toBe('superseded');
    expect(record?.version).toBe(1);
  });

  it('knows the task of a run superseded before it was heard to end', async () => {
    const noted = noting([]);

    await noted.superseding.superseded(RunId.of('run_9'), WORKSPACE, TASK);

    const record = await noted.stored('run_9');
    expect(record?.taskId?.equals(TASK)).toBe(true);
    expect(record?.hasEnded).toBe(false);
  });

  it('records nothing of a run whose team was disbanded, and lets go of what it heard of the run before', async () => {
    const noted = noting([endedRun('run_1')]);
    await noted.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await noted.forgotten.forgetTeam(WORKSPACE, TeamId.of('team_1'));

    await noted.ended('run_1');

    expect(noted.records.held.size).toBe(0);
  });
});
