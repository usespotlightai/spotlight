import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RecordSupersededRun {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  superseded(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId);
      const existing = await this.records.of(runId);

      if (!existing) {
        if (await this.deletions.isDeleted(workspaceId, taskId)) {
          return;
        }

        await this.records.add(
          RunRecord.empty(runId, workspaceId, taskId).supersededByItsTask(
            this.clock.now(),
          ),
        );
        return;
      }

      const superseded = existing.supersededByItsTask(this.clock.now());

      if (superseded !== existing) {
        await this.records.save(superseded);
      }
    });
  }
}
