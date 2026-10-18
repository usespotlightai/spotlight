import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskFailedReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationId: string;
  readonly runId: string | null;
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
  readonly at: string;
}

export class RecordTaskFailure {
  constructor(
    private readonly failures: TaskFailuresRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  failed(event: TaskFailedReceived): Promise<void> {
    const occurrence = FailureOccurrence.of({
      stationId: event.stationId,
      runId: event.runId,
      source: event.source,
      code: event.code,
      occurrences: event.occurrences,
      at: new Date(event.at),
    });

    const taskId = TaskId.of(event.taskId);
    const workspaceId = WorkspaceId.of(event.workspaceId);
    const teamId = TeamId.of(event.teamId);

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const existing = await this.failures.of(taskId);

      if (!existing) {
        if (!(await this.deletions.isDeleted(workspaceId, taskId, teamId))) {
          await this.failures.add(
            TaskFailures.empty(taskId, workspaceId, teamId).raise(occurrence),
          );
        }
        return;
      }

      const raised = existing.raise(occurrence);

      if (raised !== existing) {
        await this.failures.save(raised);
      }
    });
  }
}
