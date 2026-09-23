import type { StationKind } from '@work/domain/entities/station.entity';
import { StationColor } from '@work/domain/value-objects/station-color.vo';

export interface ReviewsRow {
  readonly start: string;
  readonly mention: string;
  readonly skip: {
    readonly spotlight: boolean;
    readonly drafts: boolean;
    readonly authors: readonly string[];
  };
}

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const line = pgTable(
  'line',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    name: text('name').notNull(),
    role: text('role'),
    reviews: jsonb('reviews').$type<ReviewsRow>(),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('line_team_idx').on(table.teamId),
    index('line_workspace_idx').on(table.workspaceId),
  ],
);

// No unique constraint on position: Postgres checks per row, so swaps would fail.
export const station = pgTable(
  'station',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    lineId: text('line_id')
      .notNull()
      .references(() => line.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    color: text('color').notNull().default(StationColor.plain().value),
    description: text('description'),
    kind: text('kind').$type<StationKind>().notNull().default('work'),
    finishes: boolean('finishes').notNull().default(false),
    harness: text('harness'),
    model: text('model'),
    effort: text('effort'),
    agentPrompt: text('agent_prompt'),
    check: text('check'),
    setup: text('setup'),
    diffs: boolean('diffs').notNull().default(false),
    decisions: boolean('decisions').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('station_line_idx').on(table.lineId),
    uniqueIndex('station_line_key_idx').on(table.lineId, table.key),
  ],
);

export const stationRoute = pgTable(
  'station_route',
  {
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
    toStationId: text('to_station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.stationId, table.toStationId] }),
    index('station_route_station_idx').on(table.stationId),
  ],
);

export const stationTool = pgTable(
  'station_tool',
  {
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stationId, table.tool] }),
    index('station_tool_station_idx').on(table.stationId),
  ],
);

export const stationSkill = pgTable(
  'station_skill',
  {
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stationId, table.skill] }),
    index('station_skill_station_idx').on(table.stationId),
  ],
);

export const lineRepository = pgTable(
  'line_repository',
  {
    lineId: text('line_id')
      .notNull()
      .references(() => line.id, { onDelete: 'cascade' }),
    repository: text('repository').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.lineId, table.repository] }),
    index('line_repository_line_idx').on(table.lineId),
  ],
);

export const lineReaction = pgTable(
  'line_reaction',
  {
    lineId: text('line_id')
      .notNull()
      .references(() => line.id, { onDelete: 'cascade' }),
    happening: text('happening').notNull(),
    fromStationId: text('from_station_id').references(() => station.id, {
      onDelete: 'cascade',
    }),
    toStationId: text('to_station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
  },
  (table) => [index('line_reaction_line_idx').on(table.lineId)],
);

export const lineDefinition = pgTable('line_definition', {
  lineId: text('line_id')
    .primaryKey()
    .references(() => line.id, { onDelete: 'cascade' }),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  definedAt: timestamp('defined_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
