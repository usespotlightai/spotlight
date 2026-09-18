import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class GrantAttachmentUploadHandler
  implements
    CommandHandlerPort<GrantAttachmentUploadCommand, AttachmentUploadDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly files: AttachmentStorePort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(
    command: GrantAttachmentUploadCommand,
  ): Promise<AttachmentUploadDto | null> {
    try {
      const uploader = UserId.of(command.uploadedBy);
      const workspace = await this.workspaces.findForMember(
        command.slug,
        uploader,
      );

      if (!workspace) {
        return null;
      }

      const file = Attachment.of({
        id: this.ids.generate(),
        name: command.name,
        contentType: command.contentType,
        size: command.size,
      });

      const grant = await this.files.grant(
        WorkspaceId.of(workspace.id),
        uploader,
        file,
      );

      return { id: file.id.value, url: grant.url, headers: grant.headers };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
