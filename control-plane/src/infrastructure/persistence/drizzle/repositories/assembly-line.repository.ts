import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AnalysisPrompt } from '@domain/value-objects/analysis-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { Opener } from '@domain/value-objects/opener.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
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
import {
  assemblyLine,
  assemblyLineOpener,
  assemblyLineReaction,
  station,
  stationRoute,
  stationTool,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

type LineRow = typeof assemblyLine.$inferSelect;
type StationRow = typeof station.$inferSelect;

type Ways = {
  routes: Map<string, StationId[]>;
  tools: Map<string, Tool[]>;
};

const toStation = (row: StationRow, ways: Ways): Station =>
  Station.create({
    key: row.key ? StationKey.of(row.key) : StationKey.from(row.name),
    id: StationId.of(row.id),
    name: StationName.of(row.name),
    position: row.position,
    color: StationColor.of(row.color),
    description: row.description
      ? StationDescription.of(row.description)
      : null,
    harness: row.harness ? HarnessId.of(row.harness) : null,
    agentPrompt: row.agentPrompt ? AgentPrompt.of(row.agentPrompt) : null,
    kind: row.kind,
    wayOut: WayOut.of({
      stations: ways.routes.get(row.id) ?? [],
      ends: row.finishes,
    }),
    tools: ways.tools.get(row.id) ?? [],
  });

const toLine = (
  line: LineRow,
  stations: StationRow[],
  ways: Ways,
  reactions: readonly Reaction[],
  openers: readonly Opener[],
): AssemblyLine =>
  AssemblyLine.of({
    id: AssemblyLineId.of(line.id),
    workspaceId: WorkspaceId.of(line.workspaceId),
    factoryId: FactoryId.of(line.factoryId),
    key: LineKey.of(line.key || 'default'),
    name: AssemblyLineName.of(line.name),
    stations: stations.map((row) => toStation(row, ways)),
    reactions,
    openers,
    analysis:
      line.analysisTitle && line.analysisBrief
        ? AnalysisPrompt.of({
            title: line.analysisTitle,
            brief: line.analysisBrief,
          })
        : null,
  });

const routeRowsOf = (line: AssemblyLine) =>
  line.stations.flatMap((each) =>
    each.wayOut.stations.map((to) => ({
      stationId: each.id.value,
      toStationId: to.value,
    })),
  );

const toolRowsOf = (line: AssemblyLine) =>
  line.stations.flatMap((each) =>
    each.tools.map((tool) => ({
      stationId: each.id.value,
      tool: tool.value,
    })),
  );

const reactionRowsOf = (line: AssemblyLine) =>
  line.reactions.map((each) => ({
    assemblyLineId: line.id.value,
    happening: each.happening.value,
    fromStationId: each.from?.value ?? null,
    toStationId: each.to.value,
  }));

const openerRowsOf = (line: AssemblyLine) =>
  line.openers.map((each) => ({
    assemblyLineId: line.id.value,
    happening: each.happening.value,
    toStationId: each.to.value,
  }));

const columnsOf = (each: Station) => ({
  key: each.key.value,
  name: each.name.value,
  position: each.position,
  color: each.color.value,
  description: each.description?.value ?? null,
  harness: each.harness?.value ?? null,
  agentPrompt: each.agentPrompt?.value ?? null,
  kind: each.kind,
  finishes: each.wayOut.ends,
});

const rowsOf = (line: AssemblyLine) =>
  line.stations.map((each) => ({
    id: each.id.value,
    assemblyLineId: line.id.value,
    ...columnsOf(each),
  }));

@Injectable()
export class DrizzleAssemblyLineRepository implements AssemblyLineRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: AssemblyLine): Promise<void> {
    await this.context.db.insert(assemblyLine).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      factoryId: added.factoryId.value,
      key: added.key.value,
      name: added.name.value,
      analysisTitle: added.analysis?.title ?? null,
      analysisBrief: added.analysis?.brief ?? null,
    });

    await this.context.db.insert(station).values(rowsOf(added));
    await this.writeWays(added);
  }

  async save(saved: AssemblyLine): Promise<void> {
    await this.context.db
      .update(assemblyLine)
      .set({
        key: saved.key.value,
        name: saved.name.value,
        analysisTitle: saved.analysis?.title ?? null,
        analysisBrief: saved.analysis?.brief ?? null,
      })
      .where(eq(assemblyLine.id, saved.id.value));

    for (const each of saved.stations) {
      await this.context.db
        .update(station)
        .set(columnsOf(each))
        .where(eq(station.id, each.id.value));
    }

    // Written whole rather than diffed: a station's ways out are few.
    const held = saved.stations.map((each) => each.id.value);

    await this.context.db
      .delete(stationRoute)
      .where(inArray(stationRoute.stationId, held));
    await this.context.db
      .delete(stationTool)
      .where(inArray(stationTool.stationId, held));
    await this.context.db
      .delete(assemblyLineReaction)
      .where(eq(assemblyLineReaction.assemblyLineId, saved.id.value));
    await this.context.db
      .delete(assemblyLineOpener)
      .where(eq(assemblyLineOpener.assemblyLineId, saved.id.value));
    await this.writeWays(saved);
  }

  private async writeWays(line: AssemblyLine): Promise<void> {
    const routes = routeRowsOf(line);
    const reactions = reactionRowsOf(line);
    const openers = openerRowsOf(line);
    const tools = toolRowsOf(line);

    if (routes.length > 0) {
      await this.context.db.insert(stationRoute).values(routes);
    }
    if (tools.length > 0) {
      await this.context.db.insert(stationTool).values(tools);
    }
    if (reactions.length > 0) {
      await this.context.db.insert(assemblyLineReaction).values(reactions);
    }
    if (openers.length > 0) {
      await this.context.db.insert(assemblyLineOpener).values(openers);
    }
  }

  private async waysOf(stations: StationRow[]): Promise<Ways> {
    const held = stations.map((each) => each.id);
    const ways: Ways = { routes: new Map(), tools: new Map() };

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
      .where(inArray(stationTool.stationId, held));

    for (const row of tools) {
      const found = ways.tools.get(row.stationId) ?? [];
      found.push(Tool.of(row.tool));
      ways.tools.set(row.stationId, found);
    }

    return ways;
  }

  private async reactionsOf(lineId: string): Promise<Reaction[]> {
    const held = await this.context.db
      .select()
      .from(assemblyLineReaction)
      .where(eq(assemblyLineReaction.assemblyLineId, lineId));

    return held.map((row) =>
      Reaction.of({
        happening: Happening.of(row.happening),
        from: row.fromStationId ? StationId.of(row.fromStationId) : null,
        to: StationId.of(row.toStationId),
      }),
    );
  }

  private async openersOf(lineId: string): Promise<Opener[]> {
    const held = await this.context.db
      .select()
      .from(assemblyLineOpener)
      .where(eq(assemblyLineOpener.assemblyLineId, lineId));

    return held.map((row) =>
      Opener.of({
        happening: Happening.of(row.happening),
        to: StationId.of(row.toStationId),
      }),
    );
  }

  async holding(stationId: StationId): Promise<AssemblyLine | null> {
    const [found] = await this.context.db
      .select({ assemblyLineId: station.assemblyLineId })
      .from(station)
      .where(eq(station.id, stationId.value))
      .limit(1);

    return found ? this.find(AssemblyLineId.of(found.assemblyLineId)) : null;
  }

  async find(id: AssemblyLineId): Promise<AssemblyLine | null> {
    const [found] = await this.context.db
      .select()
      .from(assemblyLine)
      .where(eq(assemblyLine.id, id.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const stations = await this.context.db
      .select()
      .from(station)
      .where(eq(station.assemblyLineId, id.value))
      .orderBy(station.position);

    const [ways, reactions, openers] = await Promise.all([
      this.waysOf(stations),
      this.reactionsOf(id.value),
      this.openersOf(id.value),
    ]);

    return toLine(found, stations, ways, reactions, openers);
  }

  async ofTeam(teamId: TeamId): Promise<readonly AssemblyLine[]> {
    const found = await this.context.db
      .select({ id: assemblyLine.id })
      .from(assemblyLine)
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(assemblyLine.id);

    return this.allOf(found.map((each) => each.id));
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly AssemblyLine[]> {
    const found = await this.context.db
      .select({ id: assemblyLine.id })
      .from(assemblyLine)
      .where(eq(assemblyLine.workspaceId, workspaceId.value))
      .orderBy(assemblyLine.id);

    return this.allOf(found.map((each) => each.id));
  }

  private async allOf(
    ids: readonly string[],
  ): Promise<readonly AssemblyLine[]> {
    const held: AssemblyLine[] = [];

    for (const id of ids) {
      const line = await this.find(AssemblyLineId.of(id));

      if (line) {
        held.push(line);
      }
    }

    return held;
  }
}
