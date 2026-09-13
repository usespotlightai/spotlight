import { Line } from '@domain/aggregates/line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { LineRepository } from '@domain/repositories/line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { Effort } from '@domain/value-objects/effort.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  lineReaction,
  lineRepository,
  station,
  stationRoute,
  stationSkill,
  stationTool,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

type LineRow = typeof line.$inferSelect;
type StationRow = typeof station.$inferSelect;

type Ways = {
  routes: Map<string, StationId[]>;
  tools: Map<string, Tool[]>;
  skills: Map<string, SkillKey[]>;
};

const toStation = (row: StationRow, ways: Ways): Station =>
  Station.of({
    key: StationKey.of(row.key),
    id: StationId.of(row.id),
    name: StationName.of(row.name),
    position: row.position,
    color: StationColor.of(row.color),
    description: row.description
      ? StationDescription.of(row.description)
      : null,
    harness: row.harness ? HarnessId.of(row.harness) : null,
    model: row.model ? HarnessModel.of(row.model) : null,
    effort: row.effort ? Effort.of(row.effort) : null,
    agentPrompt: row.agentPrompt ? AgentPrompt.of(row.agentPrompt) : null,
    kind: row.kind,
    wayOut: WayOut.of({
      stations: ways.routes.get(row.id) ?? [],
      ends: row.finishes,
    }),
    tools: ways.tools.get(row.id) ?? [],
    skills: ways.skills.get(row.id) ?? [],
  });

const toLine = (
  line: LineRow,
  stations: StationRow[],
  ways: Ways,
  reactions: readonly Reaction[],
  repositories: readonly Repository[],
): Line =>
  Line.of({
    id: LineId.of(line.id),
    workspaceId: WorkspaceId.of(line.workspaceId),
    factoryId: FactoryId.of(line.factoryId),
    key: LineKey.of(line.key),
    name: LineName.of(line.name),
    stations: stations.map((row) => toStation(row, ways)),
    reactions,
    role: line.role ? LineRole.of(line.role) : null,
    repositories,
  });

const routeRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.wayOut.stations.map((to) => ({
      stationId: each.id.value,
      toStationId: to.value,
    })),
  );

const toolRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.tools.map((tool, position) => ({
      stationId: each.id.value,
      tool: tool.value,
      position,
    })),
  );

const skillRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.skills.map((skill, position) => ({
      stationId: each.id.value,
      skill: skill.value,
      position,
    })),
  );

const reactionRowsOf = (line: Line) =>
  line.reactions.map((each) => ({
    lineId: line.id.value,
    happening: each.happening.value,
    fromStationId: each.from?.value ?? null,
    toStationId: each.to.value,
  }));

const repositoryRowsOf = (line: Line) =>
  line.repositories.all.map((each) => ({
    lineId: line.id.value,
    repository: each.value,
  }));

const columnsOf = (each: Station) => ({
  key: each.key.value,
  name: each.name.value,
  position: each.position,
  color: each.color.value,
  description: each.description?.value ?? null,
  harness: each.harness?.value ?? null,
  model: each.model?.value ?? null,
  effort: each.effort?.value ?? null,
  agentPrompt: each.agentPrompt?.value ?? null,
  kind: each.kind,
  finishes: each.wayOut.ends,
});

const rowsOf = (line: Line) =>
  line.stations.map((each) => ({
    id: each.id.value,
    lineId: line.id.value,
    ...columnsOf(each),
  }));

@Injectable()
export class DrizzleLineRepository implements LineRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Line): Promise<void> {
    await this.context.db.insert(line).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      factoryId: added.factoryId.value,
      key: added.key.value,
      name: added.name.value,
      role: added.role?.value ?? null,
    });

    await this.context.db.insert(station).values(rowsOf(added));
    await this.writeWays(added);
  }

  async save(saved: Line): Promise<void> {
    await this.context.db
      .update(line)
      .set({
        key: saved.key.value,
        name: saved.name.value,
        role: saved.role?.value ?? null,
      })
      .where(eq(line.id, saved.id.value));

    const standing = await this.context.db
      .select({ id: station.id })
      .from(station)
      .where(eq(station.lineId, saved.id.value));
    const kept = new Set(saved.stations.map((each) => each.id.value));
    const existing = new Set(standing.map((each) => each.id));
    const dropped = standing
      .map((each) => each.id)
      .filter((id) => !kept.has(id));

    if (dropped.length > 0) {
      await this.context.db.delete(station).where(inArray(station.id, dropped));
    }

    for (const each of saved.stations.filter((one) =>
      existing.has(one.id.value),
    )) {
      await this.context.db
        .update(station)
        .set(columnsOf(each))
        .where(eq(station.id, each.id.value));
    }

    const added = saved.stations.filter((each) => !existing.has(each.id.value));

    if (added.length > 0) {
      await this.context.db.insert(station).values(
        added.map((each) => ({
          id: each.id.value,
          lineId: saved.id.value,
          ...columnsOf(each),
        })),
      );
    }

    const held = saved.stations.map((each) => each.id.value);

    await this.context.db
      .delete(stationRoute)
      .where(inArray(stationRoute.stationId, held));
    await this.context.db
      .delete(stationTool)
      .where(inArray(stationTool.stationId, held));
    await this.context.db
      .delete(stationSkill)
      .where(inArray(stationSkill.stationId, held));
    await this.context.db
      .delete(lineReaction)
      .where(eq(lineReaction.lineId, saved.id.value));
    await this.context.db
      .delete(lineRepository)
      .where(eq(lineRepository.lineId, saved.id.value));
    await this.writeWays(saved);
  }

  private async writeWays(line: Line): Promise<void> {
    const routes = routeRowsOf(line);
    const reactions = reactionRowsOf(line);
    const tools = toolRowsOf(line);
    const skills = skillRowsOf(line);
    const repositories = repositoryRowsOf(line);

    if (routes.length > 0) {
      await this.context.db.insert(stationRoute).values(routes);
    }
    if (tools.length > 0) {
      await this.context.db.insert(stationTool).values(tools);
    }
    if (skills.length > 0) {
      await this.context.db.insert(stationSkill).values(skills);
    }
    if (reactions.length > 0) {
      await this.context.db.insert(lineReaction).values(reactions);
    }
    if (repositories.length > 0) {
      await this.context.db.insert(lineRepository).values(repositories);
    }
  }

  private async waysOf(stations: StationRow[]): Promise<Ways> {
    const held = stations.map((each) => each.id);
    const ways: Ways = {
      routes: new Map(),
      tools: new Map(),
      skills: new Map(),
    };

    if (held.length === 0) {
      return ways;
    }

    const routes = await this.context.db
      .select()
      .from(stationRoute)
      .where(inArray(stationRoute.stationId, held));

    for (const row of routes) {
      const found = ways.routes.get(row.stationId) ?? [];
      found.push(StationId.of(row.toStationId));
      ways.routes.set(row.stationId, found);
    }

    const tools = await this.context.db
      .select()
      .from(stationTool)
      .where(inArray(stationTool.stationId, held))
      .orderBy(stationTool.position);

    for (const row of tools) {
      const found = ways.tools.get(row.stationId) ?? [];
      found.push(Tool.of(row.tool));
      ways.tools.set(row.stationId, found);
    }

    const skills = await this.context.db
      .select()
      .from(stationSkill)
      .where(inArray(stationSkill.stationId, held))
      .orderBy(stationSkill.position);

    for (const row of skills) {
      const found = ways.skills.get(row.stationId) ?? [];
      found.push(SkillKey.of(row.skill));
      ways.skills.set(row.stationId, found);
    }

    return ways;
  }

  private async reactionsOf(lineId: string): Promise<Reaction[]> {
    const held = await this.context.db
      .select()
      .from(lineReaction)
      .where(eq(lineReaction.lineId, lineId));

    return held.map((row) =>
      Reaction.of({
        happening: Happening.of(row.happening),
        from: row.fromStationId ? StationId.of(row.fromStationId) : null,
        to: StationId.of(row.toStationId),
      }),
    );
  }

  private async repositoriesOf(lineId: string): Promise<Repository[]> {
    const held = await this.context.db
      .select()
      .from(lineRepository)
      .where(eq(lineRepository.lineId, lineId));

    return held.map((row) => Repository.of(row.repository));
  }

  async holding(stationId: StationId): Promise<Line | null> {
    const [found] = await this.context.db
      .select({ lineId: station.lineId })
      .from(station)
      .where(eq(station.id, stationId.value))
      .limit(1);

    return found ? this.find(LineId.of(found.lineId)) : null;
  }

  async find(id: LineId): Promise<Line | null> {
    const [found] = await this.context.db
      .select()
      .from(line)
      .where(eq(line.id, id.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const stations = await this.context.db
      .select()
      .from(station)
      .where(eq(station.lineId, id.value))
      .orderBy(station.position);

    const [ways, reactions, repositories] = await Promise.all([
      this.waysOf(stations),
      this.reactionsOf(id.value),
      this.repositoriesOf(id.value),
    ]);

    return toLine(found, stations, ways, reactions, repositories);
  }

  async ofTeam(teamId: TeamId): Promise<readonly Line[]> {
    const found = await this.context.db
      .select({ id: line.id })
      .from(line)
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(line.id);

    return this.allOf(found.map((each) => each.id));
  }

  async withRole(teamId: TeamId, role: LineRole): Promise<Line | null> {
    const [found] = await this.context.db
      .select({ id: line.id })
      .from(line)
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(and(eq(factory.teamId, teamId.value), eq(line.role, role.value)))
      .orderBy(line.id)
      .limit(1);

    return found ? this.find(LineId.of(found.id)) : null;
  }

  async ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Line[]> {
    const found = await this.context.db
      .select({ id: line.id })
      .from(line)
      .where(eq(line.workspaceId, workspaceId.value))
      .orderBy(line.id);

    return this.allOf(found.map((each) => each.id));
  }

  private async allOf(ids: readonly string[]): Promise<readonly Line[]> {
    const held: Line[] = [];

    for (const id of ids) {
      const line = await this.find(LineId.of(id));

      if (line) {
        held.push(line);
      }
    }

    return held;
  }
}
