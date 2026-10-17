import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import type { TaskFailuresRepository } from '@outcomes/domain/repositories/task-failures.repository';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskFailedHeard {
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

export class NoteTaskFailed {
  constructor(
    private readonly failures: TaskFailuresRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  failed(heard: TaskFailedHeard): Promise<void> {
    const occurrence = FailureOccurrence.of({
      stationId: heard.stationId,
      runId: heard.runId,
      source: heard.source,
      code: heard.code,
      occurrences: heard.occurrences,
      at: new Date(heard.at),
    });

    const taskId = TaskId.of(heard.taskId);
    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const teamId = TeamId.of(heard.teamId);

    return this.transaction.inTransaction(async () => {
      await this.forgotten.holding(workspaceId, taskId, teamId);
      const held = await this.failures.of(taskId);

      if (!held) {
        if (!(await this.forgotten.forgot(workspaceId, taskId, teamId))) {
          await this.failures.add(
            TaskFailures.heardOf(taskId, workspaceId, teamId).raise(occurrence),
          );
        }
        return;
      }

      const raised = held.raise(occurrence);

      if (raised !== held) {
        await this.failures.save(raised);
      }
    });
  }
}
