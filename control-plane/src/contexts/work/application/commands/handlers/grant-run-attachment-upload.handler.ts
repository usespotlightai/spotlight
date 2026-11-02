import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { GrantRunAttachmentUploadCommand } from '@work/application/commands/runner.commands';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class GrantRunAttachmentUploadHandler
  implements
    CommandHandlerPort<
      GrantRunAttachmentUploadCommand,
      AttachmentUploadDto | null
    >
{
  constructor(
    private readonly runs: RunRepository,
    private readonly files: AttachmentStorePort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(
    command: GrantRunAttachmentUploadCommand,
  ): Promise<AttachmentUploadDto | null> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run?.isLeasedBy(RunnerId.of(command.runnerId))) {
        return null;
      }

      run.mayActBeyondItself('attach a file');

      const file = Attachment.of({
        id: this.ids.generate(),
        name: command.name,
        contentType: command.contentType,
        size: command.size,
      });

      const grant = await this.files.grant(run.workspaceId, run.id, file);

      return { id: file.id.value, url: grant.url, headers: grant.headers };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
