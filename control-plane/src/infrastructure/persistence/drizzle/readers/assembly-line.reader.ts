import type {
  AssemblyLineDetail,
  AssemblyLineReaderPort,
  StationSummary,
} from '@application/ports/assembly-line-reader.port';
import type { StationKind } from '@domain/entities/station.entity';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  assemblyLine,
  assemblyLineReaction,
  assemblyLineRepository,
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
  stationModel: string | null;
  stationEffort: string | null;
  stationAgentPrompt: string | null;
  stationKind: StationKind | null;
};

type ReactionRow = {
  lineId: string;
  happening: string;
  from: string | null;
  to: string;
};

type RepositoryRow = {
  lineId: string;
  repository: string;
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
        stationModel: station.model,
        stationEffort: station.effort,
        stationAgentPrompt: station.agentPrompt,
        stationKind: station.kind,
      })
      .from(assemblyLine)
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .leftJoin(station, eq(station.assemblyLineId, assemblyLine.id))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(assemblyLine.createdAt, station.position);

    const reactions = await this.db
      .select({
        lineId: assemblyLineReaction.assemblyLineId,
        happening: assemblyLineReaction.happening,
        from: assemblyLineReaction.fromStationId,
        to: assemblyLineReaction.toStationId,
      })
      .from(assemblyLineReaction)
      .innerJoin(
        assemblyLine,
        eq(assemblyLine.id, assemblyLineReaction.assemblyLineId),
      )
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(assemblyLineReaction.happening);

    const repositories = await this.db
      .select({
        lineId: assemblyLineRepository.assemblyLineId,
        repository: assemblyLineRepository.repository,
      })
      .from(assemblyLineRepository)
      .innerJoin(
        assemblyLine,
        eq(assemblyLine.id, assemblyLineRepository.assemblyLineId),
      )
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(assemblyLineRepository.repository);

    return group(rows, reactions, repositories);
  }
}

const group = (
  rows: Row[],
  reacting: readonly ReactionRow[],
  working: readonly RepositoryRow[],
): AssemblyLineDetail[] => {
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
        model: row.stationModel,
        effort: row.stationEffort,
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
    reactions: reacting
      .filter((each) => each.lineId === id)
      .map(({ happening, from, to }) => ({ happening, from, to })),
    repositories: working
      .filter((each) => each.lineId === id)
      .map((each) => each.repository),
  }));
};
