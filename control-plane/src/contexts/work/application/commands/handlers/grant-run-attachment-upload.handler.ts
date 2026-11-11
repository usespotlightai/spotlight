import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { GrantRunAttachmentUploadCommand } from '@work/application/commands/grant-run-attachment-upload.command';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class GrantRunAttachmentUploadHandler
  implements
    CommandHandlerPort<
      GrantRunAttachmentUploadCommand,
      AttachmentUploadDto | null
    >
{
  constructor(
    private readonly leases: RunLeasesPort,
    private readonly files: AttachmentStorePort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(
    command: GrantRunAttachmentUploadCommand,
  ): Promise<AttachmentUploadDto | null> {
    try {
      const run = await this.leases.leasedBy(
        RunId.of(command.runId),
        RunnerId.of(command.runnerId),
      );

      if (!run) {
        return null;
      }

      if (!run.policy.actsBeyondItself) {
        throw new NotAllowedForIsolatedRunError('attach a file');
      }

      const file = Attachment.of({
        id: this.ids.generate(),
        name: command.name,
        contentType: command.contentType,
        size: command.size,
      });

      const grant = await this.files.grant(run.workspaceId, run.runId, file);

      return { id: file.id.value, url: grant.url, headers: grant.headers };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
