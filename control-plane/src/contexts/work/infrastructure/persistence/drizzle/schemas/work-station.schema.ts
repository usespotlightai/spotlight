import { index, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

export const workStationKind = pgEnum('work_station_kind', [
  'backlog',
  'work',
  'completed',
]);

export const workStation = pgTable(
  'work_station',
  {
    stationId: text('station_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    lineKey: text('line_key').notNull(),
    lineName: text('line_name').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    kind: workStationKind('kind').notNull(),
    color: text('color').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('work_station_team_idx').on(table.teamId),
    index('work_station_line_idx').on(table.lineId),
  ],
);

export const workLine = pgTable('work_line', {
  lineId: text('line_id').primaryKey(),
  lineVersion: integer('line_version'),
  savedVersion: integer('saved_version'),
});

export const workTeam = pgTable('work_team', {
  teamId: text('team_id').primaryKey(),
  key: text('key').notNull(),
  nextNumber: integer('next_number').notNull().default(1),
});
