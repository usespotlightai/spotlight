import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  EnabledAtStation,
  EnabledAtStationsPort,
  StationReference,
} from '@work/application/ports/enabled-at-stations.port';
import {
  line,
  station,
  stationSkill,
  stationTool,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleEnabledAtStations implements EnabledAtStationsPort {
  constructor(private readonly context: DrizzleContext) {}

  onTeam(
    teamId: TeamId,
    reference: StationReference,
  ): Promise<readonly EnabledAtStation[]> {
    switch (reference) {
      case 'tool':
        return this.context.db
          .select({
            name: stationTool.tool,
            line: line.key,
            station: station.key,
          })
          .from(stationTool)
          .innerJoin(station, eq(station.id, stationTool.stationId))
          .innerJoin(line, eq(line.id, station.lineId))
          .where(eq(line.teamId, teamId.value))
          .orderBy(asc(line.key), asc(station.key), asc(stationTool.tool));
      case 'skill':
        return this.context.db
          .select({
            name: stationSkill.skill,
            line: line.key,
            station: station.key,
          })
          .from(stationSkill)
          .innerJoin(station, eq(station.id, stationSkill.stationId))
          .innerJoin(line, eq(line.id, station.lineId))
          .where(eq(line.teamId, teamId.value))
          .orderBy(asc(line.key), asc(station.key), asc(stationSkill.skill));
      case 'profile':
        return this.profilesOn(teamId);
    }
  }

  private async profilesOn(
    teamId: TeamId,
  ): Promise<readonly EnabledAtStation[]> {
    return (
      await this.context.db
        .select({ name: station.profile, line: line.key, station: station.key })
        .from(station)
        .innerJoin(line, eq(line.id, station.lineId))
        .where(and(eq(line.teamId, teamId.value), isNotNull(station.profile)))
        .orderBy(asc(line.key), asc(station.key))
    ).flatMap((each) => (each.name ? [{ ...each, name: each.name }] : []));
  }
}
