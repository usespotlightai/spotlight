import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { AttachmentReaderPort } from '@application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ReadAttachmentQuery } from '@application/queries/read-attachment.query';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
      rethrowAsFault(error);
    }
  }
}
