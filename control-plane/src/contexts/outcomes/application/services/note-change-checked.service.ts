import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { verdictOf } from '@outcomes/domain/value-objects/check-verdict';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NoteChangeChecked {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  checked(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    passed: boolean | null,
  ): Promise<void> {
    const verdict = verdictOf(passed);

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId);
      const existing = await this.records.of(runId);

      if (!existing) {
        if (await this.deletions.isDeleted(workspaceId, taskId)) {
          return;
        }

        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).recordCheck(
            verdict,
            this.clock.now(),
          ),
        );
        return;
      }

      const checked = existing.recordCheck(verdict, this.clock.now());

      if (checked !== existing) {
        await this.records.save(checked);
      }
    });
  }
}
