import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { NoteFilesPort } from '@work/application/ports/note-files.port';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class NoteFiles implements NoteFilesPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly files: AttachmentStorePort,
  ) {}

  async open(taskId: string, attachmentId: string): Promise<Uint8Array | null> {
    const task = await this.tasks.find(TaskId.of(taskId));
    const file = task?.allAttachments.find(
      (each) => each.id.value === attachmentId,
    );

    return task && file
      ? (await this.files.open(task.workspaceId, file)).bytes
      : null;
  }
}
