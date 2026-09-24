import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  KeptLine,
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

@Injectable()
export class DrizzleLineResources implements LineResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<KeptLine | null> {
    return this.kept(eq(line.id, id));
  }

  at(teamId: TeamId, key: string): Promise<KeptLine | null> {
    return this.kept(and(eq(line.teamId, teamId.value), eq(line.key, key)));
  }

  async ofTeam(teamId: TeamId): Promise<readonly KeptLine[]> {
    const held = await this.context.db
      .select({ id: line.id })
      .from(line)
      .where(eq(line.teamId, teamId.value));
    const kept = await Promise.all(
      held.map((each) => this.kept(eq(line.id, each.id))),
    );

    return kept.filter((each): each is KeptLine => each !== null);
  }

  private async kept(where: SQL | undefined): Promise<KeptLine | null> {
    const db = this.context.db;
    const [found] = await db.select().from(line).where(where).limit(1);

    if (!found) {
      return null;
    }

    const stations = await db
      .select()
      .from(station)
      .where(eq(station.lineId, found.id))
      .orderBy(asc(station.position));
    const held = stations.map((each) => each.id);

    const [routes, tools, skills, reactions, repositories] = await Promise.all([
      held.length > 0
        ? db
            .select()
            .from(stationRoute)
            .where(inArray(stationRoute.stationId, held))
        : [],
      held.length > 0
        ? db
            .select({
              stationId: stationTool.stationId,
              name: stationTool.tool,
            })
            .from(stationTool)
            .where(inArray(stationTool.stationId, held))
            .orderBy(asc(stationTool.position))
        : [],
      held.length > 0
        ? db
            .select({
              stationId: stationSkill.stationId,
              name: stationSkill.skill,
            })
            .from(stationSkill)
            .where(inArray(stationSkill.stationId, held))
            .orderBy(asc(stationSkill.position))
        : [],
      db.select().from(lineReaction).where(eq(lineReaction.lineId, found.id)),
      db
        .select({ repository: lineRepository.repository })
        .from(lineRepository)
        .where(eq(lineRepository.lineId, found.id)),
    ]);

    return {
      id: found.id,
      version: found.version,
      teamId: TeamId.of(found.teamId),
      key: found.key,
      definition: renderLineRows({
        line: found,
        stations,
        routes,
        tools,
        skills,
        reactions,
        repositories: repositories.map((each) => each.repository),
      }),
    };
  }
}
