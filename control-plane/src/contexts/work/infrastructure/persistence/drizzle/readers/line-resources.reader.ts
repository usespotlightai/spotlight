import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  LineRecord,
  LineResourcesPort,
} from '@work/application/ports/line-resources.port';
import { renderLineRows } from '@work/infrastructure/lines/line-rows.render';
import {
  line,
  lineReaction,
  lineRepository,
  station,
  stationRoute,
  stationSkill,
  stationTool,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';

const byLine = <T>(
  rows: readonly T[],
  lineOf: (row: T) => string | undefined,
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const lineId = lineOf(row);

    if (lineId === undefined) {
      continue;
    }

    const group = grouped.get(lineId);

    if (group) {
      group.push(row);
    } else {
      grouped.set(lineId, [row]);
    }
  }

  return grouped;
};

@Injectable()
export class DrizzleLineResources implements LineResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  async withId(id: string): Promise<LineRecord | null> {
    const [found] = await this.kept(eq(line.id, id));

    return found ?? null;
  }

  async at(teamId: TeamId, key: string): Promise<LineRecord | null> {
    const [found] = await this.kept(
      and(eq(line.teamId, teamId.value), eq(line.key, key)),
    );

    return found ?? null;
  }

  ofTeam(teamId: TeamId): Promise<readonly LineRecord[]> {
    return this.kept(eq(line.teamId, teamId.value));
  }

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly LineRecord[]> {
    if (teamIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.kept(
      inArray(
        line.teamId,
        teamIds.map((each) => each.value),
      ),
    );
  }

  private async kept(where: SQL | undefined): Promise<LineRecord[]> {
    const db = this.context.db;
    const lines = await db.select().from(line).where(where);

    if (lines.length === 0) {
      return [];
    }

    const lineIds = lines.map((each) => each.id);
    const stations = await db
      .select()
      .from(station)
      .where(inArray(station.lineId, lineIds))
      .orderBy(asc(station.position));
    const stationIds = stations.map((each) => each.id);
    const lineOfStation = new Map(
      stations.map((each) => [each.id, each.lineId]),
    );
    const onStation = (row: { readonly stationId: string }) =>
      lineOfStation.get(row.stationId);

    const routes =
      stationIds.length > 0
        ? await db
            .select()
            .from(stationRoute)
            .where(inArray(stationRoute.stationId, stationIds))
        : [];
    const tools =
      stationIds.length > 0
        ? await db
            .select({
              stationId: stationTool.stationId,
              name: stationTool.tool,
            })
            .from(stationTool)
            .where(inArray(stationTool.stationId, stationIds))
            .orderBy(asc(stationTool.position))
        : [];
    const skills =
      stationIds.length > 0
        ? await db
            .select({
              stationId: stationSkill.stationId,
              name: stationSkill.skill,
            })
            .from(stationSkill)
            .where(inArray(stationSkill.stationId, stationIds))
            .orderBy(asc(stationSkill.position))
        : [];
    const reactions = await db
      .select()
      .from(lineReaction)
      .where(inArray(lineReaction.lineId, lineIds));
    const repositories = await db
      .select({
        lineId: lineRepository.lineId,
        repository: lineRepository.repository,
        image: lineRepository.image,
        setup: lineRepository.setup,
      })
      .from(lineRepository)
      .where(inArray(lineRepository.lineId, lineIds));

    const stationsOf = byLine(stations, (each) => each.lineId);
    const routesOf = byLine(routes, onStation);
    const toolsOf = byLine(tools, onStation);
    const skillsOf = byLine(skills, onStation);
    const reactionsOf = byLine(reactions, (each) => each.lineId);
    const repositoriesOf = byLine(repositories, (each) => each.lineId);

    return lines.map((found) => ({
      id: found.id,
      version: found.version,
      teamId: TeamId.of(found.teamId),
      key: found.key,
      definition: renderLineRows({
        line: found,
        stations: stationsOf.get(found.id) ?? [],
        routes: routesOf.get(found.id) ?? [],
        tools: toolsOf.get(found.id) ?? [],
        skills: skillsOf.get(found.id) ?? [],
        reactions: reactionsOf.get(found.id) ?? [],
        repositories: repositoriesOf.get(found.id) ?? [],
      }),
    }));
  }
}
