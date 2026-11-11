import {
  type InboxSection,
  inboxSectionOf,
} from '@work/application/read-models/inbox-section';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { sql } from 'drizzle-orm';

export const chatWaiting = sql<boolean>`exists (select 1 from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'message' and "chat_message"."acknowledged_at" is null)`;

export const chatRunning = sql`(${chat.currentRunId} is not null or ${chatWaiting})`;

export const chatUnread = sql<boolean>`exists (select 1 from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'proposed' and ("chat"."read_at" is null or "chat_message"."at" > "chat"."read_at"))`;

export const chatSectionOf = (row: {
  readonly unread: boolean;
  readonly resolvedAt: Date | null;
  readonly working: string | null;
  readonly waiting: boolean;
}): InboxSection => {
  const running = row.working !== null || row.waiting;

  return inboxSectionOf({
    unread: row.unread,
    resolved: row.resolvedAt !== null && !running,
    running,
  });
};
