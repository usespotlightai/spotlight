import type { TaskToolContext } from '@application/ports/integration-tools.port';
import type { PendingSaying, RunWork } from '@application/services/run-work';
import type { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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

  pending(): readonly PendingSaying[] {
    return this.task.undelivered.map((note) => ({
      position: this.task.notes.indexOf(note),
      body: note.body.value,
      attachments: note.attachments,
    }));
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

    return { kind: 'task', run: this.run, task: this.task, line };
  }
}
