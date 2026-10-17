import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { MemoryWay } from '@outcomes/domain/value-objects/run-memories.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunMemoriesHeard {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly way: MemoryWay;
  readonly memories: readonly string[];
}

export class NoteRunMemories {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  async used(heard: RunMemoriesHeard): Promise<void> {
    if (heard.memories.length === 0) {
      return;
    }

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = TaskId.of(heard.taskId);
    const run = await this.work.endedRun(heard.runId);
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.forgotten.holding(workspaceId, taskId, teamId);
      const runId = RunId.of(heard.runId);
      const held = await this.records.of(runId);

      if (await this.forgotten.forgot(workspaceId, taskId, teamId)) {
        if (held) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!held) {
        await this.records.add(
          RunRecord.heardOf(runId, workspaceId, taskId).recordMemories(
            heard.way,
            heard.memories,
          ),
        );
        return;
      }

      const used = held.recordMemories(heard.way, heard.memories);

      if (used !== held) {
        await this.records.save(used);
      }
    });
  }
}
