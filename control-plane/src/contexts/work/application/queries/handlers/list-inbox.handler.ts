import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxItemDto } from '@work/application/dto/inbox.dto';
import type { InboxReaderPort } from '@work/application/ports/inbox-reader.port';
import type { ListInboxQuery } from '@work/application/queries/list-inbox.query';

export class ListInboxHandler
  implements QueryHandlerPort<ListInboxQuery, InboxItemDto[] | null>
{
  constructor(private readonly inbox: InboxReaderPort) {}

  async execute(query: ListInboxQuery): Promise<InboxItemDto[] | null> {
    try {
      const waiting = await this.inbox.listForWorkspaceMember(
        query.slug,
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
