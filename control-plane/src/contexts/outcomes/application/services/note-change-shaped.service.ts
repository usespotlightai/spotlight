import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import {
  type ChangeShape,
  TaskChangeShape,
} from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import type { TaskChangeShapeRepository } from '@outcomes/domain/repositories/task-change-shape.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeShaped {
  readonly runId: string;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly shape: ChangeShape;
}

export class NoteChangeShaped {
  constructor(
    private readonly work: WorkPort,
    private readonly shapes: TaskChangeShapeRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  async shaped(shaped: ChangeShaped): Promise<void> {
    const run = await this.work.endedRun(shaped.runId);

    if (
      !run ||
      run.workspaceId !== shaped.workspaceId ||
      run.taskId !== shaped.taskId
    ) {
      return;
    }

    const taskId = TaskId.of(shaped.taskId);
    const workspaceId = WorkspaceId.of(shaped.workspaceId);
    const teamId = TeamId.of(run.teamId);

    await this.transaction.inTransaction(async () => {
      await this.forgotten.lockForgetting(workspaceId, taskId, teamId);

      if (await this.forgotten.forgot(workspaceId, taskId, teamId)) {
        return;
      }

      const existing = await this.shapes.forTask(taskId);

      if (!existing) {
        await this.shapes.add(
          TaskChangeShape.create({
            taskId,
            workspaceId,
            teamId,
            shape: shaped.shape,
          }),
        );
        return;
      }

      const latest = existing.withShape(shaped.shape);

      if (latest !== existing) {
        await this.shapes.save(latest);
      }
    });
  }
}
