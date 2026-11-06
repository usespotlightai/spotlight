import { mapPage, type Page } from '@shared-kernel/application/dto/page.dto';
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
  constructor(private readonly inbox: InboxReaderPort) {}

  async execute(query: ListInboxQuery): Promise<Page<InboxEntryDto> | null> {
    try {
      const viewer = UserId.of(query.viewerId);

      if (query.state === 'resolved') {
        const page = await this.inbox.resolvedForWorkspaceMember(
          query.slug,
          viewer,
          query.page,
        );

        return page && mapPage(page, entryDtoOf);
      }

      const open = await this.inbox.openForWorkspaceMember(query.slug, viewer);

      return open && { items: open.map(entryDtoOf), next: null };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadInboxItemHandler
  implements QueryHandlerPort<ReadInboxItemQuery, InboxItemViewDto | null>
{
  constructor(private readonly inbox: InboxReaderPort) {}

  async execute(query: ReadInboxItemQuery): Promise<InboxItemViewDto | null> {
    try {
      const found = await this.inbox.itemForWorkspaceMember(
        query.slug,
        UserId.of(query.viewerId),
        query.itemId,
      );

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
  constructor(private readonly inbox: InboxReaderPort) {}

  async execute(query: ReadInboxNoticeQuery): Promise<InboxNoticeDto | null> {
    try {
      const found = await this.inbox.noticeForWorkspaceMember(
        query.slug,
        UserId.of(query.viewerId),
        query.noticeId,
      );

      return found && noticeDtoOf(found);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
