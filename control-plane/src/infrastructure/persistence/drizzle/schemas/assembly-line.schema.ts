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
} from 'drizzle-orm/pg-core';

export const assemblyLine = pgTable(
  'assembly_line',
  {
    id: text('id').primaryKey(),
    /** What it is called in the file that describes it. */
    key: text('key').notNull().default('default'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    factoryId: text('factory_id')
      .notNull()
      .references(() => factory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** What the line is for, so work can be routed to it by purpose. */
    role: text('role'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('assembly_line_factory_idx').on(table.factoryId),
    index('assembly_line_workspace_idx').on(table.workspaceId),
  ],
);

/** No unique constraint on `position`: Postgres checks per row, so swapping
 *  two in one statement would fail. Reordering arrives before it would pay. */
export const station = pgTable(
  'station',
  {
    id: text('id').primaryKey(),
    /**
     * What it is called in the file. Matched on when configuration is read
     * again, so a station that was edited is the same station, and the tasks
     * standing at it are not stranded.
     */
    key: text('key').notNull().default(''),
    assemblyLineId: text('assembly_line_id')
      .notNull()
      .references(() => assemblyLine.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    color: text('color').notNull().default('#a3a8b0'),
    description: text('description'),
    kind: text('kind').$type<StationKind>().notNull().default('work'),
    finishes: boolean('finishes').notNull().default(false),
    // None means nothing works this station, so it holds what it is given.
    harness: text('harness'),
    // Which model the harness answers with. None falls back to its default.
    model: text('model'),
    // How hard the harness is told to think. None leaves its own default.
    effort: text('effort'),
    agentPrompt: text('agent_prompt'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('station_assembly_line_idx').on(table.assemblyLineId)],
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

/** What a run at this station may reach for, one row per tool. */
export const stationTool = pgTable(
  'station_tool',
  {
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stationId, table.tool] }),
    index('station_tool_station_idx').on(table.stationId),
  ],
);

/** A repository a run on this line works in, one row per repository. */
export const assemblyLineRepository = pgTable(
  'assembly_line_repository',
  {
    assemblyLineId: text('assembly_line_id')
      .notNull()
      .references(() => assemblyLine.id, { onDelete: 'cascade' }),
    /** As owner/name, the way Spotlight holds it. */
    repository: text('repository').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.assemblyLineId, table.repository] }),
    index('assembly_line_repository_line_idx').on(table.assemblyLineId),
  ],
);

/**
 * What a word from outside does on this line: where the task has to be
 * standing for it to count, and where it goes. A null from is wherever it
 * stands.
 */
export const assemblyLineReaction = pgTable(
  'assembly_line_reaction',
  {
    assemblyLineId: text('assembly_line_id')
      .notNull()
      .references(() => assemblyLine.id, { onDelete: 'cascade' }),
    happening: text('happening').notNull(),
    fromStationId: text('from_station_id').references(() => station.id, {
      onDelete: 'cascade',
    }),
    toStationId: text('to_station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('assembly_line_reaction_line_idx').on(table.assemblyLineId),
  ],
);
