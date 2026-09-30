import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NoteRunSuperseded {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly transaction: TransactionPort,
  ) {}

  superseded(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.transaction.run(async () => {
      const held = await this.records.of(runId);

      if (!held) {
        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).supersededByItsTask(),
        );
        return;
      }

      const superseded = held.supersededByItsTask();

      if (superseded !== held) {
        await this.records.save(superseded);
      }
    });
  }
}
