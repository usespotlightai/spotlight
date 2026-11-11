import type { ChatInboxFacts } from '@work/domain/services/chat-inbox';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { sql } from 'drizzle-orm';

const chatWaiting = sql<boolean>`exists (select 1 from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'message' and "chat_message"."acknowledged_at" is null)`;

const chatHasCurrentRun = sql<boolean>`${chat.currentRunId} is not null`;

export const chatRunningWhere = sql<boolean>`(${chatHasCurrentRun} or ${chatWaiting})`;

export const chatResolvedWhere = sql<boolean>`(${chat.resolvedAt} is not null and not ${chatRunningWhere})`;

export const chatUnresolvedWhere = sql<boolean>`(not ${chatResolvedWhere})`;

export const chatInboxFacts = {
  waiting: chatWaiting,
  lastProposedAt:
    sql<Date | null>`(select max("chat_message"."at") from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'proposed')`.mapWith(
      (value: string) => new Date(value),
    ),
};

export const chatInboxFactsOf = (row: {
  readonly currentRunId: string | null;
  readonly resolvedAt: Date | null;
  readonly readAt: Date | null;
  readonly waiting: boolean;
  readonly lastProposedAt: Date | null;
}): ChatInboxFacts => ({
  hasCurrentRun: row.currentRunId !== null,
  waiting: row.waiting,
  readAt: row.readAt,
  lastProposedAt: row.lastProposedAt,
  resolvedAt: row.resolvedAt,
});
