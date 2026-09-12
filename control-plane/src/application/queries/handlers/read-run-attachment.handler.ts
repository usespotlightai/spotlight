import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { AttachmentReaderPort } from '@application/ports/attachment-reader.port';
import type {
  AttachmentContent,
  AttachmentStorePort,
} from '@application/ports/attachment-store.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ReadRunAttachmentQuery } from '@application/queries/read-run-attachment.query';
import type { RunRepository } from '@domain/repositories/run.repository';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { RunId } from '@domain/value-objects/run-id.vo';

export class ReadRunAttachmentHandler
  implements QueryHandlerPort<ReadRunAttachmentQuery, AttachmentContent | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly attachments: AttachmentReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async execute(
    query: ReadRunAttachmentQuery,
  ): Promise<AttachmentContent | null> {
    try {
      const [run, held] = await Promise.all([
        this.runs.findById(RunId.of(query.runId)),
        this.attachments.find(query.attachmentId),
      ]);

      if (
        !run?.taskId ||
        run.claimedBy?.value !== query.runnerId ||
        held?.taskId !== run.taskId.value
      ) {
        return null;
      }

      return await this.files.open(run.workspaceId, Attachment.rehydrate(held));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
