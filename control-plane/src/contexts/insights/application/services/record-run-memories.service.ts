import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { isMemoryVia } from '@insights/domain/value-objects/run-memories.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunMemoriesReceived {
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly via: string;
  readonly memories: readonly string[];
}

export class RecordRunMemories {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  async used(event: RunMemoriesReceived): Promise<void> {
    const via = event.via;

    if (!event.taskId || !isMemoryVia(via)) {
      return;
    }

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);
    const run = await this.work.endedRun(event.runId);
    const teamId = run ? TeamId.of(run.teamId) : null;

    const runId = RunId.of(event.runId);

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        erased: (existing) => existing.erased(),
        load: () => this.records.of(runId),
        fresh: () => RunRecord.empty(runId, workspaceId, taskId),
        change: (record) => record.recordMemories(via, event.memories),
      }),
    );
  }
}
