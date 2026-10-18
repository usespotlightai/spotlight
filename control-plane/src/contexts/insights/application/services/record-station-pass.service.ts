import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  passed(event: TaskPassedReceived): Promise<void> {
    const pass = StationPass.of(event.to, new Date(event.at));

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId);
      const runId = RunId.of(event.runId);
      const existing = await this.records.of(runId);

      if (!existing) {
        if (!(await this.deletions.isDeleted(workspaceId, taskId))) {
          await this.records.add(
            RunRecord.empty(runId, workspaceId, taskId).passTo(pass),
          );
        }
        return;
      }

      const passed = existing.passTo(pass);

      if (passed !== existing) {
        await this.records.save(passed);
      }
    });
  }
}
