import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

type Ended =
  | [string, number]
  | [string, number, Parameters<typeof endedRecord>[1]];

const acting = async (...runs: Ended[]) => {
  const records = new RunRecordsInMemory();

  for (const [runId, hour, change] of runs) {
    await records.add(endedRecord(runId, { endedAt: at(hour), ...change }));
  }

  const service = new NotePersonAct(
    records,
    forgottenInMemory(),
    inTransaction,
  );

  return {
    records,
    acted: (act: string, hour: number, after: string | null = null) =>
      service.acted({
        taskId: 'task_1',
        workspaceId: 'ws_1',
        stationId: 'station_1',
        act,
        after,
        at: at(hour).toISOString(),
      }),
    next: async (runId: string) =>
      (await records.of(RunId.of(runId)))?.next?.act ?? null,
  };
};

describe('noting what a person did after a run', () => {
  it('gives the act to the run it names', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10]);

    await noted.acted('sent-back', 11, 'run_1');

    expect(await noted.next('run_1')).toBe('sent-back');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('gives an act that names no run to the task’s latest run that ended before it', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10], ['run_3', 12]);

    await noted.acted('approved', 11);

    expect(await noted.next('run_2')).toBe('approved');
    expect(await noted.next('run_1')).toBeNull();
    expect(await noted.next('run_3')).toBeNull();
  });

  it('gives an act that names no run to the latest run at the station the task was acted on at', async () => {
    const noted = await acting(
      ['run_1', 9],
      ['run_2', 10, { stationId: 'station_2' }],
    );

    await noted.acted('parked', 11);

    expect(await noted.next('run_1')).toBe('parked');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('gives no act to a run withdrawn before it ran', async () => {
    const noted = await acting(
      ['run_1', 9],
      ['run_2', 10, { ending: 'withdrawn' }],
    );

    await noted.acted('closed', 11);

    expect(await noted.next('run_1')).toBe('closed');
    expect(await noted.next('run_2')).toBeNull();
  });

  it('counts only the first act after a run', async () => {
    const noted = await acting(['run_1', 9]);

    await noted.acted('sent-back', 10);
    await noted.acted('closed', 11);

    expect(await noted.next('run_1')).toBe('sent-back');
  });

  it('does not hand a later act to an earlier run already acted on', async () => {
    const noted = await acting(['run_1', 9], ['run_2', 10]);
    await noted.acted('sent-back', 11, 'run_2');

    await noted.acted('closed', 12);

    expect(await noted.next('run_1')).toBeNull();
    expect(await noted.next('run_2')).toBe('sent-back');
  });

  it('keeps an act that names a run heard of before the run ended', async () => {
    const noted = await acting();

    await noted.acted('answered', 11, 'run_7');

    expect(await noted.next('run_7')).toBe('answered');
    expect((await noted.records.of(RunId.of('run_7')))?.taskId?.value).toBe(
      'task_1',
    );
  });

  it('ignores an act that names no run when the task has no ended run', async () => {
    const noted = await acting();

    await noted.acted('closed', 11);

    expect(noted.records.held.size).toBe(0);
  });

  it('ignores an act it does not know', async () => {
    const noted = await acting(['run_1', 9]);

    await noted.acted('danced', 10);

    expect(await noted.next('run_1')).toBeNull();
  });
});

describe('noting how a run’s change was checked', () => {
  it('fills in the verdict on a recorded run', async () => {
    const records = new RunRecordsInMemory();
    await records.add(endedRecord('run_1'));

    await new NoteChangeChecked(
      records,
      forgottenInMemory(),
      inTransaction,
    ).checked(RunId.of('run_1'), WORKSPACE, null, false);

    expect((await records.of(RunId.of('run_1')))?.checks).toBe('failed');
  });

  it('keeps a verdict heard before the run was heard to end', async () => {
    const records = new RunRecordsInMemory();

    await new NoteChangeChecked(
      records,
      forgottenInMemory(),
      inTransaction,
    ).checked(RunId.of('run_1'), WORKSPACE, TaskId.of('task_1'), null);

    const record = await records.of(RunId.of('run_1'));
    expect(record?.checks).toBe('skipped');
    expect(record?.hasEnded).toBe(false);
    expect(record?.taskId?.value).toBe('task_1');
  });
});
