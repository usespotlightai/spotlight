import type {
  LineDetail,
  LineReaderPort,
  StationSummary,
} from '@application/ports/line-reader.port';
import type { StationKind } from '@domain/entities/station.entity';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  lineReaction,
  lineRepository,
  station,
  stationSkill,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import {
  team,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

const STATION_COLUMNS = {
  stationId: station.id,
  stationKey: station.key,
  stationName: station.name,
  stationPosition: station.position,
  stationColor: station.color,
  stationDescription: station.description,
  stationHarness: station.harness,
  stationModel: station.model,
  stationEffort: station.effort,
  stationAgentPrompt: station.agentPrompt,
  stationKind: station.kind,
};

type StationRow = {
  stationId: string;
  stationKey: string;
  stationName: string;
  stationPosition: number;
  stationColor: string;
  stationDescription: string | null;
  stationHarness: string | null;
  stationModel: string | null;
  stationEffort: string | null;
  stationAgentPrompt: string | null;
  stationKind: StationKind;
};

type Row = {
  lineId: string;
  lineKey: string;
  lineName: string;
} & { [K in keyof StationRow]: StationRow[K] | null };

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

type SkillRow = {
  stationId: string;
  skill: string;
};

const holdsStation = (row: Row): row is Row & StationRow =>
  row.stationId !== null;

@Injectable()
export class DrizzleLineReader implements LineReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<LineDetail[] | null> {
    if (!(await this.visible(teamId, userId))) {
      return null;
    }

    const rows = await this.db
      .select({
        lineId: line.id,
        lineKey: line.key,
        lineName: line.name,
        ...STATION_COLUMNS,
      })
      .from(line)
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .leftJoin(station, eq(station.lineId, line.id))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(line.createdAt, station.position);

    const reactions = await this.db
      .select({
        lineId: lineReaction.lineId,
        happening: lineReaction.happening,
        from: lineReaction.fromStationId,
        to: lineReaction.toStationId,
      })
      .from(lineReaction)
      .innerJoin(line, eq(line.id, lineReaction.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(lineReaction.happening);

    const repositories = await this.db
      .select({
        lineId: lineRepository.lineId,
        repository: lineRepository.repository,
      })
      .from(lineRepository)
      .innerJoin(line, eq(line.id, lineRepository.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(lineRepository.repository);

    const skills = await this.db
      .select({ stationId: stationSkill.stationId, skill: stationSkill.skill })
      .from(stationSkill)
      .innerJoin(station, eq(station.id, stationSkill.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(stationSkill.position);

    return group(rows, reactions, repositories, skills);
  }

  async stationFor(
    teamId: TeamId,
    userId: UserId,
    lineId: string,
    stationId: string,
  ): Promise<StationSummary | null> {
    if (!(await this.visible(teamId, userId))) {
      return null;
    }

    const [found] = await this.db
      .select(STATION_COLUMNS)
      .from(station)
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(
        and(
          eq(factory.teamId, teamId.value),
          eq(line.id, lineId),
          eq(station.id, stationId),
        ),
      )
      .limit(1);

    if (!found) {
      return null;
    }

    const skills = await this.db
      .select({ stationId: stationSkill.stationId, skill: stationSkill.skill })
      .from(stationSkill)
      .where(eq(stationSkill.stationId, stationId))
      .orderBy(stationSkill.position);

    return summaryOf(found, skills);
  }

  private async visible(teamId: TeamId, userId: UserId): Promise<boolean> {
    const [found] = await this.db
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

    return found !== undefined;
  }
}

const summaryOf = (
  row: StationRow,
  skills: readonly SkillRow[],
): StationSummary => ({
  id: row.stationId,
  key: row.stationKey,
  name: row.stationName,
  position: row.stationPosition,
  color: row.stationColor,
  description: row.stationDescription,
  harness: row.stationHarness,
  model: row.stationModel,
  effort: row.stationEffort,
  agentPrompt: row.stationAgentPrompt,
  kind: row.stationKind,
  skills: skills
    .filter((each) => each.stationId === row.stationId)
    .map((each) => each.skill),
});

const group = (
  rows: Row[],
  reacting: readonly ReactionRow[],
  working: readonly RepositoryRow[],
  skills: readonly SkillRow[],
): LineDetail[] => {
  const lines = new Map<
    string,
    { key: string; name: string; stations: StationSummary[] }
  >();

  for (const row of rows) {
    const line = lines.get(row.lineId) ?? {
      key: row.lineKey,
      name: row.lineName,
      stations: [],
    };

    if (holdsStation(row)) {
      line.stations.push(summaryOf(row, skills));
    }

    lines.set(row.lineId, line);
  }

  return [...lines].map(([id, line]) => ({
    id,
    key: line.key,
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
