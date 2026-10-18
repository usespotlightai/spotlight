import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { MemoryVia } from '@insights/domain/value-objects/run-memories.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunMemoriesReceived {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly via: MemoryVia;
  readonly memories: readonly string[];
}

export class RecordRunMemories {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async used(event: RunMemoriesReceived): Promise<void> {
    if (event.memories.length === 0) {
      return;
    }

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);
    const run = await this.work.endedRun(event.runId);
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const runId = RunId.of(event.runId);
      const existing = await this.records.of(runId);

      if (await this.deletions.isDeleted(workspaceId, taskId, teamId)) {
        if (existing) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        await this.records.add(
          RunRecord.empty(runId, workspaceId, taskId).recordMemories(
            event.via,
            event.memories,
          ),
        );
        return;
      }

      const used = existing.recordMemories(event.via, event.memories);

      if (used !== existing) {
        await this.records.save(used);
      }
    });
  }
}
