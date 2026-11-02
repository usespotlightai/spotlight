import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticeFileDto } from '@work/application/dto/notice-file.dto';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { NoticeFilesPort } from '@work/application/ports/notice-files.port';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class NoticeFiles implements NoticeFilesPort {
  constructor(private readonly files: AttachmentStorePort) {}

  async open(workspaceId: string, file: NoticeFileDto): Promise<Uint8Array> {
    const content = await this.files.open(
      WorkspaceId.of(workspaceId),
      Attachment.rehydrate({
        id: file.id,
        name: file.name,
        contentType: file.type,
        size: file.size,
      }),
    );

    return content.bytes;
  }
}
