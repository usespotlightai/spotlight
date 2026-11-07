import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentReaderPort } from '@work/application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { NoteFilesPort } from '@work/application/ports/note-files.port';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class NoteFiles implements NoteFilesPort {
  constructor(
    private readonly attachments: AttachmentReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async open(taskId: string, attachmentId: string): Promise<Uint8Array | null> {
    const found = await this.attachments.find(attachmentId);

    return found?.holder.kind === 'task' && found.holder.taskId === taskId
      ? (
          await this.files.open(
            WorkspaceId.of(found.workspaceId),
            Attachment.of({
              id: found.id,
              name: found.name,
              contentType: found.contentType,
              size: found.size,
            }),
          )
        ).bytes
      : null;
  }
}
