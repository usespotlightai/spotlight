import type { AttachmentReaderPort } from '@application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import { InvalidAttachmentError } from '@domain/exceptions/invalid-attachment.error';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import { AttachmentId } from '@domain/value-objects/attachment-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class FilesAtHand {
  constructor(
    private readonly attachments: AttachmentReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async handedOver(
    workspaceId: WorkspaceId,
    ids: readonly string[],
  ): Promise<Attachment[]> {
    const named = ids.map((each) => AttachmentId.of(each));

    const alreadyGiven = await Promise.all(
      named.map((each) => this.attachments.find(each.value)),
    );

    if (alreadyGiven.some((each) => each !== null)) {
      throw new InvalidAttachmentError('was given to a task already');
    }

    return this.files.received(workspaceId, named);
  }
}
