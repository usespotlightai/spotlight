import type {
  AssemblyLineDetail,
  AssemblyLineReaderPort,
  StationSummary,
} from '@application/ports/assembly-line-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  team,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

type Row = {
  lineId: string;
  lineName: string;
  stationId: string | null;
  stationName: string | null;
  stationPosition: number | null;
  stationColor: string | null;
  stationDescription: string | null;
  stationHarness: string | null;
  stationAgentPrompt: string | null;
  stationKind: 'backlog' | 'work' | null;
};

@Injectable()
export class DrizzleAssemblyLineReader implements AssemblyLineReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<AssemblyLineDetail[] | null> {
    // Asked separately, not folded into the join below, so "no such team for
    // you" stays distinguishable from "a team with an empty board".
    const [visible] = await this.db
      .select({ id: team.id })
      .from(team)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, team.workspaceId),
          eq(workspaceMember.userId, userId.value),
        ),
      )
      .where(eq(team.id, teamId.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    const rows = await this.db
      .select({
        lineId: assemblyLine.id,
        lineName: assemblyLine.name,
        stationId: station.id,
        stationName: station.name,
        stationPosition: station.position,
        stationColor: station.color,
        stationDescription: station.description,
        stationHarness: station.harness,
        stationAgentPrompt: station.agentPrompt,
        stationKind: station.kind,
      })
      .from(assemblyLine)
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .leftJoin(station, eq(station.assemblyLineId, assemblyLine.id))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(assemblyLine.createdAt, station.position);

    return group(rows);
  }
}

const group = (rows: Row[]): AssemblyLineDetail[] => {
  const lines = new Map<string, { name: string; stations: StationSummary[] }>();

  for (const row of rows) {
    const line = lines.get(row.lineId) ?? { name: row.lineName, stations: [] };

    if (row.stationId !== null && row.stationPosition !== null) {
      line.stations.push({
        id: row.stationId,
        name: row.stationName ?? '',
        position: row.stationPosition,
        color: row.stationColor ?? '',
        description: row.stationDescription,
        harness: row.stationHarness,
        agentPrompt: row.stationAgentPrompt,
        kind: row.stationKind ?? 'work',
      });
    }

    lines.set(row.lineId, line);
  }

  return [...lines].map(([id, line]) => ({
    id,
    name: line.name,
    stations: line.stations,
  }));
};
