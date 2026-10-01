import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskHandedOnHeard {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly to: string;
  readonly at: string;
}

export class NoteRunHandedOn {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  handedOn(heard: TaskHandedOnHeard): Promise<void> {
    const handedOn = HandedOn.of(heard.to, new Date(heard.at));

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = TaskId.of(heard.taskId);

    return this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId);
      const runId = RunId.of(heard.runId);
      const held = await this.records.of(runId);

      if (!held) {
        if (!(await this.forgotten.forgot(workspaceId, taskId))) {
          await this.records.add(
            RunRecord.heardOf(runId, workspaceId, taskId).handedOnTo(handedOn),
          );
        }
        return;
      }

      const passed = held.handedOnTo(handedOn);

      if (passed !== held) {
        await this.records.save(passed);
      }
    });
  }
}
