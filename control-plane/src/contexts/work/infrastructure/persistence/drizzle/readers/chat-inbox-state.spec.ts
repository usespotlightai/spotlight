import { chatInboxStanding } from '@work/domain/services/chat-inbox';
import {
  chatResolvedWhere,
  chatRunningWhere,
  chatUnresolvedWhere,
} from '@work/infrastructure/persistence/drizzle/readers/chat-inbox-state';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const HAS_RUN = '"chat"."current_run_id" is not null';
const WAITING =
  'exists (select 1 from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = \'message\' and "chat_message"."acknowledged_at" is null)';
const RESOLVED_AT = '"chat"."resolved_at" is not null';
const RUNNING = `(${HAS_RUN} or ${WAITING})`;

const textOf = (where: SQL): string => new PgDialect().sqlToQuery(where).sql;

const FACTS = [false, true].flatMap((hasCurrentRun) =>
  [false, true].flatMap((waiting) =>
    [null, new Date('2026-11-11T09:00:00.000Z')].map((resolvedAt) => ({
      hasCurrentRun,
      waiting,
      resolvedAt,
      readAt: null,
      lastProposedAt: null,
    })),
  ),
);

describe('the inbox filters on chats', () => {
  it('reads a chat as running when it has a run or a message waits, as chatRunning does', () => {
    expect(textOf(chatRunningWhere)).toBe(RUNNING);

    for (const facts of FACTS) {
      expect(chatInboxStanding(facts).running).toBe(
        facts.hasCurrentRun || facts.waiting,
      );
    }
  });

  it('reads a chat as resolved when it was resolved and is not running, as chatResolved does', () => {
    expect(textOf(chatResolvedWhere)).toBe(
      `(${RESOLVED_AT} and not ${RUNNING})`,
    );
    expect(textOf(chatUnresolvedWhere)).toBe(
      `(not (${RESOLVED_AT} and not ${RUNNING}))`,
    );

    for (const facts of FACTS) {
      expect(chatInboxStanding(facts).resolved).toBe(
        facts.resolvedAt !== null && !(facts.hasCurrentRun || facts.waiting),
      );
    }
  });
});
