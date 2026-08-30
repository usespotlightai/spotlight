import type { InboxItemDto } from '@application/dto/inbox.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { InboxReaderPort } from '@application/ports/inbox-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListInboxQuery } from '@application/queries/list-inbox.query';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ListInboxHandler
  implements QueryHandlerPort<ListInboxQuery, InboxItemDto[] | null>
{
  constructor(private readonly inbox: InboxReaderPort) {}

  async execute(query: ListInboxQuery): Promise<InboxItemDto[] | null> {
    try {
      const waiting = await this.inbox.listForWorkspaceMember(
        WorkspaceSlug.of(query.slug),
        UserId.of(query.viewerId),
      );

      return (
        waiting?.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          askedAt: item.askedAt.toISOString(),
          notes: item.notes.map((note) => ({
            ...note,
            at: note.at.toISOString(),
          })),
        })) ?? null
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
