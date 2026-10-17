import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NoteRunSuperseded {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  superseded(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.forgotten.holding(workspaceId, taskId);
      const held = await this.records.of(runId);

      if (!held) {
        if (await this.forgotten.forgot(workspaceId, taskId)) {
          return;
        }

        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).supersededByItsTask(
            this.clock.now(),
          ),
        );
        return;
      }

      const superseded = held.supersededByItsTask(this.clock.now());

      if (superseded !== held) {
        await this.records.save(superseded);
      }
    });
  }
}
