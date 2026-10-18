import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import {
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  SET_UP,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

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
  visit: 1,
  ...SET_UP,
  endedAt: at(10),
  ...change,
});

const recording = (runs: readonly EndedRun[]) => {
  const warned: { fields: LogFields; message: string }[] = [];
  const logger: LoggerPort = {
    debug: () => {},
    info: () => {},
    warn: (fields, message) => {
      warned.push({ fields, message });
    },
    error: () => {},
  };
  const records = new RunRecordsInMemory();
  const deletions = deletionsInMemory();
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
    deletions,
    warned,
    service: new RecordRunEnding(
      work,
      records,
      deletions,
      inTransaction,
      logger,
    ),
    superseding: new RecordSupersededRun(records, deletions, inTransaction, {
      now: () => RECEIVED_AT,
      sleep: async () => {},
    }),
    ended: (
      runId: string,
      outcome = 'completed',
      stopped = false,
      asked = false,
    ) =>
      new RecordRunEnding(
        work,
        records,
        deletions,
        inTransaction,
        logger,
      ).ended({
        runId,
        outcome,
        stopped,
        failure: outcome === 'failed' ? 'exited' : null,
        asked,
      }),
    stored: async (runId: string) => records.of(RunId.of(runId)),
  };
};

describe('recording that a run ended', () => {
  it('records where it ran, with which config, in which visit and how it ended', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.ended('run_1', 'failed');

    const record = await recorder.stored('run_1');
    expect(record?.ending).toBe('failed');
    expect(record?.end?.failure).toBe('exited');
    expect(record?.end?.fingerprint).toBe(FIRST_CONFIG);
    expect(record?.end?.location.stationId).toBe('station_1');
    expect(record?.end?.location.taskId.value).toBe('task_1');
    expect(record?.end?.endedAt).toEqual(at(10));
    expect(record?.end?.visit).toBe(1);
  });

  it('takes a config Work did not fingerprint as a SHA-256 for no config, and warns of it', async () => {
    const recorder = recording([
      endedRun('run_unfingerprinted', { fingerprint: 'not-a-sha-256' }),
    ]);

    await recorder.ended('run_unfingerprinted');

    expect(
      (await recorder.stored('run_unfingerprinted'))?.end?.fingerprint,
    ).toBe(null);
    expect(recorder.warned).toEqual([
      {
        fields: {
          runId: 'run_unfingerprinted',
          stationId: 'station_1',
          fingerprint: 'not-a-sha-256',
        },
        message:
          'Run ended with a malformed config fingerprint, recorded as no config',
      },
    ]);
  });

  it('warns of nothing when a run ended with no config', async () => {
    const recorder = recording([
      endedRun('run_unconfigured', { fingerprint: null }),
    ]);

    await recorder.ended('run_unconfigured');

    expect(recorder.warned).toEqual([]);
  });

  it('records that it ended waiting on a person', async () => {
    const recorder = recording([endedRun('run_1'), endedRun('run_2')]);

    await recorder.ended('run_1', 'completed', false, true);
    await recorder.ended('run_2');

    expect((await recorder.stored('run_1'))?.end?.asked).toBe(true);
    expect((await recorder.stored('run_1'))?.disposition).toBe('asked');
    expect((await recorder.stored('run_2'))?.end?.asked).toBe(false);
  });

  it('records a run a person stopped as stopped', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.ended('run_1', 'completed', true);

    expect((await recorder.stored('run_1'))?.ending).toBe('stopped');
  });

  it('takes the visit Work counted for the run', async () => {
    const recorder = recording([endedRun('run_1', { visit: 3 })]);

    await recorder.ended('run_1');

    expect((await recorder.stored('run_1'))?.end?.visit).toBe(3);
  });

  it('records nothing for a run Work does not know ended at a station', async () => {
    const recorder = recording([]);

    await recorder.ended('run_1');

    expect(await recorder.stored('run_1')).toBeNull();
  });

  it('records nothing for an ending it does not know', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.ended('run_1', 'exploded');

    expect(await recorder.stored('run_1')).toBeNull();
  });

  it('changes nothing when told again that the run ended', async () => {
    const recorder = recording([endedRun('run_1')]);
    await recorder.ended('run_1');
    const first = await recorder.stored('run_1');

    await recorder.ended('run_1', 'failed');

    expect(await recorder.stored('run_1')).toBe(first);
  });

  it('keeps a superseding received before the end of the run', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await recorder.ended('run_1');

    expect((await recorder.stored('run_1'))?.ending).toBe('superseded');
  });

  it('marks a recorded run superseded once, however often it is told', async () => {
    const recorder = recording([endedRun('run_1')]);
    await recorder.ended('run_1');

    await recorder.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await recorder.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);

    const record = await recorder.stored('run_1');
    expect(record?.ending).toBe('superseded');
    expect(record?.version).toBe(1);
  });

  it('knows the task of a run superseded before its end was received', async () => {
    const recorder = recording([]);

    await recorder.superseding.superseded(RunId.of('run_9'), WORKSPACE, TASK);

    const record = await recorder.stored('run_9');
    expect(record?.taskId?.equals(TASK)).toBe(true);
    expect(record?.hasEnded).toBe(false);
  });

  it('records nothing of a run whose team was deleted, and lets go of what it received about the run before', async () => {
    const recorder = recording([endedRun('run_1')]);
    await recorder.superseding.superseded(RunId.of('run_1'), WORKSPACE, TASK);
    await recorder.deletions.deleteTeam(WORKSPACE, TeamId.of('team_1'));

    await recorder.ended('run_1');

    expect(recorder.records.stored.size).toBe(0);
  });
});
