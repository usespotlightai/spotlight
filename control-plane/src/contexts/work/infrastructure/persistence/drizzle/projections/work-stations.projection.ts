import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ProjectedLine,
  WorkStationsPort,
} from '@work/application/ports/work-stations.port';
import {
  workLine,
  workStation,
} from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { and, eq, notInArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkStations implements WorkStationsPort {
  constructor(private readonly context: DrizzleContext) {}

  async project(line: ProjectedLine): Promise<void> {
    await this.context.inTransaction(async () => {
      if (!(await this.newer(line))) {
        return;
      }

      await this.withoutDroppedStations(line);
      await this.withStations(line);
    });
  }

  private async newer(line: ProjectedLine): Promise<boolean> {
    const written = await this.context.db
      .insert(workLine)
      .values({ lineId: line.lineId.value, lineVersion: line.version })
      .onConflictDoUpdate({
        target: workLine.lineId,
        set: { lineVersion: sql`excluded.line_version` },
        setWhere: sql`coalesce(${workLine.lineVersion}, -1) < excluded.line_version and coalesce(${workLine.savedVersion}, -1) <= excluded.line_version`,
      })
      .returning({ lineId: workLine.lineId });

    return written.length > 0;
  }

  private async withoutDroppedStations(line: ProjectedLine): Promise<void> {
    const kept = line.stations.map((each) => each.id.value);

    await this.context.db
      .delete(workStation)
      .where(
        kept.length > 0
          ? and(
              eq(workStation.lineId, line.lineId.value),
              notInArray(workStation.stationId, kept),
            )
          : eq(workStation.lineId, line.lineId.value),
      );
  }

  private async withStations(line: ProjectedLine): Promise<void> {
    if (line.stations.length === 0) {
      return;
    }

    await this.context.db
      .insert(workStation)
      .values(
        line.stations.map((each) => ({
          stationId: each.id.value,
          workspaceId: line.workspaceId.value,
          teamId: line.teamId.value,
          lineId: line.lineId.value,
          lineKey: line.key,
          lineName: line.name,
          key: each.key,
          name: each.name,
          kind: each.kind,
          color: each.color,
          position: each.position,
        })),
      )
      .onConflictDoUpdate({
        target: workStation.stationId,
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
  }
}
