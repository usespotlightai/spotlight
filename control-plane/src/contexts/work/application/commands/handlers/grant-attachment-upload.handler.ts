import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class GrantAttachmentUploadHandler
  implements
    CommandHandlerPort<GrantAttachmentUploadCommand, AttachmentUploadDto | null>
{
  constructor(
    private readonly access: WorkAccess,
    private readonly files: AttachmentStorePort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(
    command: GrantAttachmentUploadCommand,
  ): Promise<AttachmentUploadDto | null> {
    try {
      const uploader = UserId.of(command.uploadedBy);
      const workspaceId = await this.access.memberWorkspaceAt(
        command.slug,
        uploader,
      );

      if (!workspaceId) {
        return null;
      }

      const file = Attachment.of({
        id: this.ids.generate(),
        name: command.name,
        contentType: command.contentType,
        size: command.size,
      });

      const grant = await this.files.grant(workspaceId, uploader, file);

      return { id: file.id.value, url: grant.url, headers: grant.headers };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
