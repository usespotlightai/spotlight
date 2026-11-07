import { LineViewMapper } from '@lines/application/mappers/line-view.mapper';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { lineMapOf } from '@work/infrastructure/acl/line-map.translation';
import { eq, inArray, sql } from 'drizzle-orm';
import * as schema from './schema';

type StationRow = typeof schema.station.$inferInsert;

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
  const rows = Array.isArray(stations) ? stations : [stations as StationRow];

  await db.insert(schema.station).values(rows);
  await projectStations(
    db,
    rows.map((each) => each.id as string),
  );
};

export const mapOf = (line: Line): LineMap =>
  lineMapOf(LineViewMapper.of(line));
