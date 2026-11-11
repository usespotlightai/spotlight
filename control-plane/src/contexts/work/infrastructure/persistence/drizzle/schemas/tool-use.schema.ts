import { timestamptz } from '@platform/persistence/drizzle/columns';
import type { JsonValue } from '@shared-kernel/domain/json-value';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export interface ToolUseActingAs {
  readonly personId: string | null;
  readonly linkedAccount: string | null;
}

export const toolUse = pgTable(
  'tool_use',
  {
    useId: text('use_id').primaryKey(),
    runId: text('run_id').notNull(),
    attempt: integer('attempt').notNull(),
    tool: text('tool').notNull(),
    inputs: jsonb('inputs')
      .$type<Readonly<Record<string, JsonValue>>>()
      .notNull(),
    output: text('output').notNull(),
    failed: boolean('failed').notNull(),
    actingAs: jsonb('acting_as').$type<ToolUseActingAs>(),
    at: timestamptz('at').notNull(),
  },
  (table) => [index('tool_use_at_idx').on(table.at)],
);
