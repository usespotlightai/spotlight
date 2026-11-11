import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentReaderPort } from '@work/application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';

export class ReadAttachmentHandler implements QueryHandlerPort<
  ReadAttachmentQuery,
  string | null
> {
  constructor(
    private readonly access: WorkAccess,
    private readonly attachments: AttachmentReaderPort,
    private readonly files: AttachmentStorePort,
  ) {}

  async execute(query: ReadAttachmentQuery): Promise<string | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const [workspaceId, found] = await Promise.all([
        this.access.memberWorkspaceAt(query.slug, viewer),
        this.attachments.find(query.attachmentId),
      ]);

      const wanted = query.download ? 'saved' : 'shown';

      if (!workspaceId) {
        return null;
      }

      if (!found) {
        const id = AttachmentId.parsed(query.attachmentId);

        return id
          ? await this.files.linkPending(workspaceId, id, wanted)
          : null;
      }

      if (
        found.workspaceId !== workspaceId.value ||
        (found.holder.kind === 'chat' &&
          !(await this.access.opensChat(
            {
              startedBy: UserId.of(found.holder.startedById),
              teamId: TeamId.of(found.holder.teamId),
            },
            viewer,
          )))
      ) {
        return null;
      }

      return await this.files.link(
        WorkspaceId.of(found.workspaceId),
        Attachment.rehydrate(found),
        wanted,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
