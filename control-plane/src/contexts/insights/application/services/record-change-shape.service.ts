import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import {
  type ChangeShape,
  TaskChangeShape,
} from '@insights/domain/aggregates/task-change-shape.aggregate';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeShaped {
  readonly runId: string;
  readonly taskId: string | null;
  readonly workspaceId: string;
  readonly shape: ChangeShape;
}

export class RecordChangeShape {
  constructor(
    private readonly work: WorkPort,
    private readonly shapes: TaskChangeShapeRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  async shaped(shaped: ChangeShaped): Promise<void> {
    const run = shaped.taskId ? await this.work.endedRun(shaped.runId) : null;

    if (
      !run ||
      run.workspaceId !== shaped.workspaceId ||
      run.taskId !== shaped.taskId
    ) {
      return;
    }

    const taskId = TaskId.of(run.taskId);
    const workspaceId = WorkspaceId.of(shaped.workspaceId);
    const teamId = TeamId.of(run.teamId);

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.shapes, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        erased: (existing) => existing.erased(),
        load: () => this.shapes.forTask(taskId),
        created: () =>
          TaskChangeShape.create({
            taskId,
            workspaceId,
            teamId,
            shape: shaped.shape,
          }),
        change: (existing) => existing.withShape(shaped.shape),
      }),
    );
  }
}
