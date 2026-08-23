import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { Injectable } from '@nestjs/common';

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

    await this.context.db.insert(station).values(
      added.stations.map((each) => ({
        id: each.id.value,
        assemblyLineId: added.id.value,
        name: each.name.value,
        position: each.position,
      })),
    );
  }
}
