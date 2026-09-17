import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  AttachmentContent,
  AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import type { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';

export class ReadRunAttachmentHandler
  implements QueryHandlerPort<ReadRunAttachmentQuery, AttachmentContent | null>
{
  constructor(
    private readonly held: HeldRunReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async execute(
    query: ReadRunAttachmentQuery,
  ): Promise<AttachmentContent | null> {
    try {
      const given = await this.held.attachmentFor(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
        query.attachmentId,
      );

      return given
        ? await this.files.open(given.workspaceId, given.attachment)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
