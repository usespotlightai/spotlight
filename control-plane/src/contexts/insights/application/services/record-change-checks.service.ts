import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { verdictOf } from '@insights/domain/value-objects/check-verdict';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RecordChangeChecks {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  checked(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    passed: boolean | null,
    at: Date,
  ): Promise<void> {
    if (!taskId) {
      return Promise.resolve();
    }

    const verdict = verdictOf(passed);

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId, { taskId }),
        deleted: (existing) => existing.delete(),
        load: () => this.records.of(runId),
        fresh: () => RunRecord.empty(runId, workspaceId, taskId),
        change: (record) => record.recordCheck(verdict, at),
      }),
    );
  }
}
