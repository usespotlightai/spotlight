import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import {
  FIRST_CONFIG,
  inTransaction,
  RunRecordsInMemory,
  SET_UP,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const TASK = TaskId.of('task_1');

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const endedRun = (runId: string, change: Partial<EndedRun> = {}): EndedRun => ({
  runId: RunId.of(runId),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  taskId: TaskId.of('task_1'),
  fingerprint: FIRST_CONFIG,
  visit: 1,
  ...SET_UP,
  endedAt: at(10),
  ...change,
});

const recording = (runs: readonly EndedRun[]) => {
  const records = new RunRecordsInMemory();
  const deletions = deletionsInMemory();
  const work: WorkPort = {
    unfinishedRuns: async () => [],
    traced: async () => ({ tasks: [], stations: [], outputs: new Map() }),
    taskRunOf: async () => null,
    endedRun: async (runId) =>
      runs.find((each) => each.runId.equals(runId)) ?? null,
    configsInOrder: async () => [],
  };

  return {
    records,
    deletions,
    service: new RecordRunEnding(
      work,
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    superseding: new RecordSupersededRun(
      records,
      new FactRecorder(deletions),
      inTransaction,
    ),
    ended: (
      runId: string,
      ending: RunEnding | null = 'completed',
      asked = false,
    ) =>
      new RecordRunEnding(
        work,
        records,
        new FactRecorder(deletions),
        inTransaction,
      ).ended({
        runId,
        taskId: 'task_1',
        stationId: 'station_1',
        ending,
        failure: ending === 'failed' ? 'exited' : null,
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
    expect(record?.end?.ending).toBe('failed');
    expect(record?.end?.failure).toBe('exited');
    expect(record?.end?.fingerprint).toBe(FIRST_CONFIG);
    expect(record?.end?.location.stationId.value).toBe('station_1');
    expect(record?.end?.location.taskId.value).toBe('task_1');
    expect(record?.end?.endedAt).toEqual(at(10));
    expect(record?.end?.visit).toBe(1);
  });

  it('records that it ended waiting on a person', async () => {
    const recorder = recording([endedRun('run_1'), endedRun('run_2')]);

    await recorder.ended('run_1', 'completed', true);
    await recorder.ended('run_2');

    expect((await recorder.stored('run_1'))?.end?.asked).toBe(true);
    expect(
      (await recorder.stored('run_1'))?.factWith(null, null)?.disposition,
    ).toBe('asked');
    expect((await recorder.stored('run_2'))?.end?.asked).toBe(false);
  });

  it('records a run a person stopped as stopped', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.ended('run_1', 'stopped');

    expect((await recorder.stored('run_1'))?.factWith(null, null)?.ending).toBe(
      'stopped',
    );
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

  it('records nothing for a run without an ending', async () => {
    const recorder = recording([endedRun('run_1')]);

    await recorder.ended('run_1', null);

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

    await recorder.superseding.superseded(
      RunId.of('run_1'),
      WORKSPACE,
      TASK,
      RECEIVED_AT,
    );
    await recorder.ended('run_1');

    expect((await recorder.stored('run_1'))?.factWith(null, null)?.ending).toBe(
      'superseded',
    );
  });

  it('marks a recorded run superseded once, however often it is told', async () => {
    const recorder = recording([endedRun('run_1')]);
    await recorder.ended('run_1');

    await recorder.superseding.superseded(
      RunId.of('run_1'),
      WORKSPACE,
      TASK,
      RECEIVED_AT,
    );
    await recorder.superseding.superseded(
      RunId.of('run_1'),
      WORKSPACE,
      TASK,
      RECEIVED_AT,
    );

    const record = await recorder.stored('run_1');
    expect(record?.factWith(null, null)?.ending).toBe('superseded');
    expect(record?.version).toBe(1);
  });

  it('knows the task of a run superseded before its end was received', async () => {
    const recorder = recording([]);

    await recorder.superseding.superseded(
      RunId.of('run_9'),
      WORKSPACE,
      TASK,
      RECEIVED_AT,
    );

    const record = await recorder.stored('run_9');
    expect(record?.taskId?.equals(TASK)).toBe(true);
    expect(record?.hasEnded).toBe(false);
  });

  it('records nothing of a run whose team was deleted, and lets go of what it received about the run before', async () => {
    const recorder = recording([endedRun('run_1')]);
    await recorder.superseding.superseded(
      RunId.of('run_1'),
      WORKSPACE,
      TASK,
      RECEIVED_AT,
    );
    await recorder.deletions.markDeleted(
      DeletionScope.ofTeam(WORKSPACE, TeamId.of('team_1')),
    );

    await recorder.ended('run_1');

    expect(recorder.records.stored.size).toBe(0);
  });
});
