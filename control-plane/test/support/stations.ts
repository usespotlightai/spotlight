import { LineViewMapper } from '@lines/application/mappers/line-view.mapper';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { Sha256ContentHash } from '@platform/hashing/sha256-content-hash';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { lineMapOf } from '@work/infrastructure/acl/line-map.translation';
import { eq, inArray, sql } from 'drizzle-orm';

import * as schema from './schema';

type StationRow = typeof schema.station.$inferInsert;

const projectTeams = async (
  db: DrizzleDatabase,
  teamIds: readonly string[],
): Promise<void> => {
  const keys = await db
    .select({ id: schema.team.id, key: schema.team.key })
    .from(schema.team)
    .where(inArray(schema.team.id, [...teamIds]));
  const keyOf = new Map(keys.map((each) => [each.id, each.key]));

  await db
    .insert(schema.workTeam)
    .values(
      teamIds.map((teamId) => ({ teamId, key: keyOf.get(teamId) ?? teamId })),
    )
    .onConflictDoNothing();
};

export const projectStations = async (
  db: DrizzleDatabase,
  stationIds: readonly string[],
): Promise<void> => {
  if (stationIds.length === 0) {
    return;
  }

  const rows = await db
    .select({
      stationId: schema.station.id,
      workspaceId: schema.station.workspaceId,
      teamId: schema.line.teamId,
      lineId: schema.line.id,
      lineKey: schema.line.key,
      lineName: schema.line.name,
      key: schema.station.key,
      name: schema.station.name,
      kind: schema.station.kind,
      color: schema.station.color,
      position: schema.station.position,
    })
    .from(schema.station)
    .innerJoin(schema.line, eq(schema.line.id, schema.station.lineId))
    .where(inArray(schema.station.id, [...stationIds]));

  if (rows.length === 0) {
    return;
  }

  await projectTeams(db, [...new Set(rows.map((each) => each.teamId))]);
  await db
    .insert(schema.workStation)
    .values(rows)
    .onConflictDoUpdate({
      target: schema.workStation.stationId,
      set: {
        lineKey: sql`excluded.line_key`,
        lineName: sql`excluded.line_name`,
        key: sql`excluded.key`,
        name: sql`excluded.name`,
        kind: sql`excluded.kind`,
        color: sql`excluded.color`,
        position: sql`excluded.position`,
      },
    });
};

export const insertStations = async (
  db: DrizzleDatabase,
  stations: StationRow | readonly StationRow[],
): Promise<void> => {
  const rows = ([] as readonly StationRow[]).concat(stations);

  await db.insert(schema.station).values(rows);
  await projectStations(
    db,
    rows.map((each) => each.id),
  );
};

export const mapOf = (line: Line): LineMap =>
  lineMapOf(LineViewMapper.of(line, new Sha256ContentHash()));

export const lineChangedOf = async (
  db: DrizzleDatabase,
  lineId: string,
  stationIds: readonly string[],
): Promise<LineChangedIntegrationEvent> => {
  const [line] = await db
    .select()
    .from(schema.line)
    .where(eq(schema.line.id, lineId));

  if (!line) {
    throw new Error(`No line ${lineId}`);
  }

  const stations = await db
    .select()
    .from(schema.station)
    .where(eq(schema.station.lineId, lineId));

  return {
    kind: LINE_CHANGED,
    lineId,
    workspaceId: line.workspaceId,
    teamId: line.teamId,
    version: line.version,
    lineKey: line.key,
    lineName: line.name,
    deleted: false,
    stations: stations.map((each) => ({
      id: each.id,
      key: each.key,
      name: each.name,
      kind: each.kind,
      color: each.color,
      position: each.position,
    })),
    stationIds: [...stationIds],
  };
};
