import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  GivenTool,
  GivenToolsPort,
} from '@work/application/ports/given-tools.port';
import {
  line,
  station,
  stationTool,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleGivenTools implements GivenToolsPort {
  constructor(private readonly context: DrizzleContext) {}

  onTeam(teamId: TeamId): Promise<readonly GivenTool[]> {
    return this.context.db
      .select({ tool: stationTool.tool, line: line.key, station: station.key })
      .from(stationTool)
      .innerJoin(station, eq(station.id, stationTool.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .where(eq(line.teamId, teamId.value))
      .orderBy(asc(line.key), asc(station.key), asc(stationTool.tool));
  }
}
