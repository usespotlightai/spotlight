import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

export class AttachmentCopies {
  constructor(private readonly store: AttachmentStorePort) {}

  copy(
    workspaceId: WorkspaceId,
    files: readonly Attachment[],
    idOf: (place: number) => string,
  ): Promise<Attachment[]> {
    return Promise.all(
      files.map(async (each, place) => {
        const copy = each.copiedAs(AttachmentId.of(idOf(place)));

        await this.store.copy(workspaceId, each, copy);

        return copy;
      }),
    );
  }
}
