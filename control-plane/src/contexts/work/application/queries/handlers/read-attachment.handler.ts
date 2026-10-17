import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentReaderPort } from '@work/application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class ReadAttachmentHandler
  implements QueryHandlerPort<ReadAttachmentQuery, string | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly attachments: AttachmentReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async execute(query: ReadAttachmentQuery): Promise<string | null> {
    try {
      const [workspace, held] = await Promise.all([
        this.workspaces.findForMember(query.slug, UserId.of(query.viewerId)),
        this.attachments.find(query.attachmentId),
      ]);

      if (!workspace || held?.workspaceId !== workspace.id) {
        return null;
      }

      return await this.files.link(
        WorkspaceId.of(held.workspaceId),
        Attachment.rehydrate(held),
        query.download ? 'saved' : 'shown',
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
