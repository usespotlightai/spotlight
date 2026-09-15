import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type {
  AttachmentContent,
  AttachmentStorePort,
} from '@application/ports/attachment-store.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ReadRunAttachmentQuery } from '@application/queries/read-run-attachment.query';
import type { RunWorks } from '@application/services/run-works.service';

export class ReadRunAttachmentHandler
  implements QueryHandlerPort<ReadRunAttachmentQuery, AttachmentContent | null>
{
  constructor(
    private readonly works: RunWorks,
    private readonly files: AttachmentStorePort,
  ) {}

  async execute(
    query: ReadRunAttachmentQuery,
  ): Promise<AttachmentContent | null> {
    try {
      const worked = await this.works.of(query.runId);
      const work = worked?.work;

      if (!work || worked.run.claimedBy?.value !== query.runnerId) {
        return null;
      }

      const attachment = work.gave(query.attachmentId);

      return attachment
        ? await this.files.open(work.workspaceId, attachment)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
