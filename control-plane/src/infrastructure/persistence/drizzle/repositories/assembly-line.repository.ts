import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

type LineRow = typeof assemblyLine.$inferSelect;
type StationRow = typeof station.$inferSelect;

const toStation = (row: StationRow): Station =>
  Station.create({
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
  });

const toLine = (line: LineRow, stations: StationRow[]): AssemblyLine =>
  AssemblyLine.of({
    id: AssemblyLineId.of(line.id),
    workspaceId: WorkspaceId.of(line.workspaceId),
    factoryId: FactoryId.of(line.factoryId),
    name: AssemblyLineName.of(line.name),
    stations: stations.map(toStation),
  });

const columnsOf = (each: Station) => ({
  name: each.name.value,
  position: each.position,
  color: each.color.value,
  description: each.description?.value ?? null,
  harness: each.harness?.value ?? null,
  agentPrompt: each.agentPrompt?.value ?? null,
  kind: each.kind,
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
      name: added.name.value,
    });

    await this.context.db.insert(station).values(rowsOf(added));
  }

  async save(saved: AssemblyLine): Promise<void> {
    await this.context.db
      .update(assemblyLine)
      .set({ name: saved.name.value })
      .where(eq(assemblyLine.id, saved.id.value));

    for (const each of saved.stations) {
      await this.context.db
        .update(station)
        .set(columnsOf(each))
        .where(eq(station.id, each.id.value));
    }
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

    return toLine(found, stations);
  }
}
