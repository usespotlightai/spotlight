import type { GrantAttachmentUploadCommand } from '@application/commands/grant-attachment-upload.command';
import type { AttachmentUploadDto } from '@application/dto/attachment.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
