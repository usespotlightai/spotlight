import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const inferenceEndpoint = pgTable(
  'inference_endpoint',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    baseUrl: text('base_url').notNull(),
    model: text('model').notNull(),
    supportsReasoningEffort: boolean('supports_reasoning_effort')
      .notNull()
      .default(false),
    apiKeyVersion: integer('api_key_version'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('inference_endpoint_workspace_idx').on(table.workspaceId),
  ],
);
