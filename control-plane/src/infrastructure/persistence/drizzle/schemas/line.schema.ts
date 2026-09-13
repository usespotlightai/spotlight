import type { StationKind } from '@domain/entities/station.entity';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  boolean,
  index,
  integer,
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
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    factoryId: text('factory_id')
      .notNull()
      .references(() => factory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('line_factory_idx').on(table.factoryId),
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
    color: text('color').notNull().default('#a3a8b0'),
    description: text('description'),
    kind: text('kind').$type<StationKind>().notNull().default('work'),
    finishes: boolean('finishes').notNull().default(false),
    harness: text('harness'),
    model: text('model'),
    effort: text('effort'),
    agentPrompt: text('agent_prompt'),
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
