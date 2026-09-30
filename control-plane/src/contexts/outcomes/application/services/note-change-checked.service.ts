import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { verdictOf } from '@outcomes/domain/value-objects/check-verdict';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NoteChangeChecked {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly transaction: TransactionPort,
  ) {}

  checked(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    passed: boolean | null,
  ): Promise<void> {
    const verdict = verdictOf(passed);

    return this.transaction.run(async () => {
      const held = await this.records.of(runId);

      if (!held) {
        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).checked(verdict),
        );
        return;
      }

      const checked = held.checked(verdict);

      if (checked !== held) {
        await this.records.save(checked);
      }
    });
  }
}
