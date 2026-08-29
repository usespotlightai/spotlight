import type { TaskNoteDto } from '@application/dto/task.dto';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface InboxItemSummary {
  readonly taskId: string;
  readonly teamId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: string;
  readonly stationColor: string;
  readonly askedAt: Date;
  // Oldest first: the story, ending with what it is waiting on.
  readonly notes: readonly TaskNoteDto[];
}

export const INBOX_READER = Symbol('INBOX_READER');

export interface InboxReaderPort {
  listForWorkspaceMember(
    slug: WorkspaceSlug,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null>;
}
