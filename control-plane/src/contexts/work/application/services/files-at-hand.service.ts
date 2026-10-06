import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';

export class FilesAtHand {
  constructor(private readonly files: AttachmentStorePort) {}

  async handedOver(
    workspaceId: WorkspaceId,
    ids: readonly string[],
  ): Promise<Attachment[]> {
    return this.files.received(
      workspaceId,
      ids.map((each) => AttachmentId.of(each)),
    );
  }

  async takenIn(
    workspaceId: WorkspaceId,
    files: readonly Attachment[],
  ): Promise<void> {
    await this.files.taken(workspaceId, files);
  }
}
