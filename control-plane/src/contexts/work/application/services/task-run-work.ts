import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { RunWork } from '@work/application/services/run-work';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';

export class TaskRunWork implements RunWork {
  constructor(
    private readonly run: Run,
    private readonly task: Task,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.task.workspaceId;
  }

  async deliverUpTo(position: number, at: Date): Promise<void> {
    await this.tasks.save(
      this.task.deliveredUpTo(NotePosition.of(position), at),
    );
  }

  gave(attachmentId: string): Attachment | null {
    return (
      this.task.allAttachments.find((each) => each.id.value === attachmentId) ??
      null
    );
  }

  async repositoryNamed(name: string): Promise<Repository | null> {
    if (!this.run.stationId) {
      return null;
    }

    const line = await this.lines.holding(this.run.stationId);

    return line?.repositoryNamed(name) ?? null;
  }

  async toolContext(): Promise<TaskToolContext> {
    const stationId = this.run.stationId ?? this.task.stationId;
    const line = await this.lines.holding(stationId);

    if (!line) {
      throw new UnknownStationError(stationId.value);
    }

    return {
      kind: 'task',
      runId: this.run.id,
      workspaceId: this.task.workspaceId,
      taskId: this.task.id,
      stationId,
      stationCheck: line.stationAt(stationId)?.check?.value ?? null,
    };
  }
}
