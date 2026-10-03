import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxEntryDto } from '@work/application/dto/inbox.dto';
import type { InboxReaderPort } from '@work/application/ports/inbox-reader.port';
import type { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { Notice } from '@work/domain/aggregates/notice.aggregate';

export class ListInboxHandler
  implements QueryHandlerPort<ListInboxQuery, InboxEntryDto[] | null>
{
  constructor(
    private readonly inbox: InboxReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListInboxQuery): Promise<InboxEntryDto[] | null> {
    try {
      const waiting = await this.inbox.listForWorkspaceMember(
        query.slug,
        UserId.of(query.viewerId),
        Notice.settledShownSince(this.clock.now()),
      );

      return (
        waiting?.map(
          (item): InboxEntryDto =>
            item.kind === 'notice'
              ? { ...item, askedAt: item.askedAt.toISOString() }
              : {
                  ...item,
                  createdAt: item.createdAt.toISOString(),
                  askedAt: item.askedAt.toISOString(),
                  notes: item.notes.map((note) => ({
                    ...note,
                    at: note.at.toISOString(),
                  })),
                },
        ) ?? null
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
