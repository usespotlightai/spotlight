import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
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
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  failed(event: TaskFailedReceived): Promise<void> {
    const occurrence = FailureOccurrence.of({
      stationId: StationId.of(event.stationId),
      runId: event.runId,
      source: event.source,
      code: event.code,
      occurrences: event.occurrences,
      at: new Date(event.at),
    });

    const taskId = TaskId.of(event.taskId);
    const workspaceId = WorkspaceId.of(event.workspaceId);
    const teamId = TeamId.of(event.teamId);

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.failures, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        load: () => this.failures.of(taskId),
        deleted: (existing) => existing.delete(),
        fresh: () => TaskFailures.empty(taskId, workspaceId, teamId),
        change: (failures) => failures.raise(occurrence),
      }),
    );
  }
}
