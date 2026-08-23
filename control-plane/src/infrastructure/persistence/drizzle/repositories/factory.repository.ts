import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DrizzleFactoryRepository implements FactoryRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Factory): Promise<void> {
    await this.context.db.insert(factory).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      teamId: added.teamId.value,
    });
  }
}
