import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskPassedReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly to: string;
  readonly at: string;
}

export class RecordStationPass {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  passed(event: TaskPassedReceived): Promise<void> {
    const pass = StationPass.of(StationId.of(event.to), new Date(event.at));

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);

    const runId = RunId.of(event.runId);

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId, { taskId }),
        deleted: (existing) => existing.delete(),
        load: () => this.records.of(runId),
        fresh: () => RunRecord.empty(runId, workspaceId, taskId),
        change: (record) => record.passTo(pass),
      }),
    );
  }
}
