import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  InboxEntryDto,
  InboxItemDto,
  InboxItemViewDto,
  InboxNoticeDto,
  NoteDto,
} from '@work/application/dto/inbox.dto';
import { mapPage, type Page } from '@work/application/dto/page.dto';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxNote,
  InboxNoticeSummary,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import type {
  ListInboxQuery,
  ReadInboxItemQuery,
  ReadInboxNoticeQuery,
} from '@work/application/queries/list-inbox.query';
import type { WorkAccess } from '@work/application/services/work-access.service';

const noteDtoOf = (note: InboxNote): NoteDto => ({
  ...note,
  at: note.at.toISOString(),
});

const itemDtoOf = (item: InboxItemSummary): InboxItemDto => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  askedAt: item.askedAt.toISOString(),
  lastNote: item.lastNote && noteDtoOf(item.lastNote),
});

const noticeDtoOf = (notice: InboxNoticeSummary): InboxNoticeDto => ({
  ...notice,
  askedAt: notice.askedAt.toISOString(),
});

const entryDtoOf = (entry: InboxEntrySummary): InboxEntryDto => {
  if (entry.kind === 'task') {
    return itemDtoOf(entry);
  }

  return entry.kind === 'notice'
    ? noticeDtoOf(entry)
    : { ...entry, askedAt: entry.askedAt.toISOString() };
};

export class ListInboxHandler
  implements QueryHandlerPort<ListInboxQuery, Page<InboxEntryDto> | null>
{
  constructor(
    private readonly inbox: InboxReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ListInboxQuery): Promise<Page<InboxEntryDto> | null> {
    try {
      const scope = await this.access.inboxOf(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!scope) {
        return null;
      }

      if (query.state === 'resolved') {
        return mapPage(
          await this.inbox.resolved(scope, query.page),
          entryDtoOf,
        );
      }

      const open = await this.inbox.open(scope);

      return { items: open.map(entryDtoOf), next: null };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadInboxItemHandler
  implements QueryHandlerPort<ReadInboxItemQuery, InboxItemViewDto | null>
{
  constructor(
    private readonly inbox: InboxReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ReadInboxItemQuery): Promise<InboxItemViewDto | null> {
    try {
      const scope = await this.access.inboxOf(
        query.slug,
        UserId.of(query.viewerId),
      );
      const found = scope && (await this.inbox.item(scope, query.itemId));

      return (
        found && { ...itemDtoOf(found), notes: found.notes.map(noteDtoOf) }
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadInboxNoticeHandler
  implements QueryHandlerPort<ReadInboxNoticeQuery, InboxNoticeDto | null>
{
  constructor(
    private readonly inbox: InboxReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ReadInboxNoticeQuery): Promise<InboxNoticeDto | null> {
    try {
      const scope = await this.access.inboxOf(
        query.slug,
        UserId.of(query.viewerId),
      );
      const found = scope && (await this.inbox.notice(scope, query.noticeId));

      return found && noticeDtoOf(found);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
