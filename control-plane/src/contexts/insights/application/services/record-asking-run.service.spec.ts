import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RecordAskingRun } from '@insights/application/services/record-asking-run.service';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

describe('recording that a run asked a person', () => {
  it('records nothing for an ask a person drove, an ask the run did not make, or no run made', async () => {
    const records = new RunRecordsInMemory();
    const asking = new RecordAskingRun(
      records,
      new FactRecorder(deletionsInMemory()),
      inTransaction,
    );

    await asking.asked({
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      drivenByAPerson: true,
      runAsked: true,
    });
    await asking.asked({
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      drivenByAPerson: false,
      runAsked: false,
    });
    await asking.asked({
      runId: null,
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      drivenByAPerson: false,
      runAsked: true,
    });

    expect(await records.of(RunId.of('run_1'))).toBeNull();
  });

  it('marks the recorded run as asking', async () => {
    const records = new RunRecordsInMemory();
    await records.add(endedRecord('run_1'));

    await new RecordAskingRun(
      records,
      new FactRecorder(deletionsInMemory()),
      inTransaction,
    ).asked({
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      drivenByAPerson: false,
      runAsked: true,
    });

    expect((await records.of(RunId.of('run_1')))?.asked).toBe(true);
  });

  it('keeps an ask made before the end of the run', async () => {
    const records = new RunRecordsInMemory();

    await new RecordAskingRun(
      records,
      new FactRecorder(deletionsInMemory()),
      inTransaction,
    ).asked({
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      taskId: TaskId.of('task_1'),
      drivenByAPerson: false,
      runAsked: true,
    });

    const record = await records.of(RunId.of('run_1'));
    expect(record?.asked).toBe(true);
    expect(record?.hasEnded).toBe(false);
    expect(record?.taskId?.value).toBe('task_1');
  });
});
