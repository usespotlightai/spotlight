import { STATION_KINDS } from '@lines/domain/entities/station.entity';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { timestamptz } from '@platform/persistence/drizzle/columns';

export interface ReviewsRow {
  readonly start: string;
  readonly mention: string;
  readonly label: string;
  readonly skip: {
    readonly spotlight: boolean;
    readonly drafts: boolean;
    readonly authors: readonly string[];
  };
}

export interface ReplayCheckRow {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

export interface LineSearchRow {
  readonly enabled: boolean;
  readonly monthlyCeiling: number;
  readonly currency: string;
  readonly ceiling: number;
  readonly period: string;
  readonly onAlert: boolean;
  readonly cooldown: string;
}

export interface StationSearchRow {
  readonly enabled: boolean | null;
  readonly ceiling: number | null;
  readonly period: string | null;
  readonly onAlert: boolean | null;
  readonly cooldown: string | null;
  readonly agent: {
    readonly harness: string;
    readonly model: string | null;
    readonly effort: string | null;
  } | null;
  readonly iterations: number | null;
  readonly repeats: number | null;
  readonly objective: string | null;
}

export interface ConfigSourceRow {
  readonly repository: string;
  readonly path: string;
}

export interface StationJudgeRow {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface StationAlertRow {
  readonly measure: string;
  readonly risesBy: number | null;
  readonly above: number | null;
  readonly fallsBy: number | null;
  readonly below: number | null;
  readonly over: number;
}

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const stationKind = pgEnum('station_kind', STATION_KINDS);

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
    replayCheck: jsonb('replay_check').$type<ReplayCheckRow>(),
    search: jsonb('search').$type<LineSearchRow>(),
    source: jsonb('source').$type<ConfigSourceRow>(),
    runners: jsonb('runners').$type<string[]>().notNull().default([]),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('line_workspace_id_id_key').on(table.workspaceId, table.id),
    index('line_workspace_idx').on(table.workspaceId),
    uniqueIndex('line_team_key_idx').on(table.teamId, table.key),
    uniqueIndex('line_team_role_idx')
      .on(table.teamId, table.role)
      .where(sql`${table.role} is not null`),
  ],
);

// Do not add a unique constraint on position. Postgres checks each row, so swaps fail.
export const station = pgTable(
  'station',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    workspaceId: text('workspace_id').notNull(),
    lineId: text('line_id').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    color: text('color').notNull().default(StationColor.plain().value),
    description: text('description'),
    kind: stationKind('kind').notNull().default('work'),
    finishes: boolean('finishes').notNull().default(false),
    harness: text('harness'),
    model: text('model'),
    effort: text('effort'),
    profile: text('profile'),
    agentPrompt: text('agent_prompt'),
    check: text('check'),
    runners: jsonb('runners').$type<string[]>().notNull().default([]),
    diffs: boolean('diffs').notNull().default(false),
    decisions: boolean('decisions').notNull().default(false),
    memories: boolean('memories').notNull().default(false),
    judge: jsonb('judge').$type<StationJudgeRow>(),
    alerts: jsonb('alerts').$type<StationAlertRow[]>().notNull().default([]),
    search: jsonb('search').$type<StationSearchRow>(),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check('station_position_not_negative', sql`${table.position} >= 0`),
    unique('station_workspace_id_id_key').on(table.workspaceId, table.id),
    uniqueIndex('station_line_key_idx').on(table.lineId, table.key),
    foreignKey({
      name: 'station_line_fk',
      columns: [table.workspaceId, table.lineId],
      foreignColumns: [line.workspaceId, line.id],
    }).onDelete('cascade'),
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
    index('station_route_to_station_idx').on(table.toStationId),
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
    check('station_tool_position_not_negative', sql`${table.position} >= 0`),
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
    check('station_skill_position_not_negative', sql`${table.position} >= 0`),
  ],
);

export const lineRepository = pgTable(
  'line_repository',
  {
    lineId: text('line_id')
      .notNull()
      .references(() => line.id, { onDelete: 'cascade' }),
    repository: text('repository').notNull(),
    image: text('image'),
    setup: text('setup'),
  },
  (table) => [primaryKey({ columns: [table.lineId, table.repository] })],
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
  (table) => [
    unique('line_reaction_key')
      .on(table.lineId, table.happening, table.fromStationId)
      .nullsNotDistinct(),
    index('line_reaction_from_station_idx').on(table.fromStationId),
    index('line_reaction_to_station_idx').on(table.toStationId),
  ],
);
