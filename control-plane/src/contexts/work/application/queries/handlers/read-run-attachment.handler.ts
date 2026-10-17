import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type {
  AttachmentContent,
  AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import type { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import type { RunWorks } from '@work/application/services/run-works.service';

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
      const work = await this.works.workLeasedBy(query.runId, query.runnerId);
      const attachment = work?.attachment(query.attachmentId) ?? null;

      return work && attachment
        ? await this.files.open(work.workspaceId, attachment)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
