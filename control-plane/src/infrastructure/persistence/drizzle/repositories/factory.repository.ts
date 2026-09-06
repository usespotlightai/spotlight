import { Factory } from '@domain/aggregates/factory.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

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

  async ofTeam(teamId: TeamId): Promise<Factory | null> {
    const [found] = await this.context.db
      .select()
      .from(factory)
      .where(eq(factory.teamId, teamId.value))
      .limit(1);

    if (!found) {
      return null;
    }

    return Factory.of({
      id: FactoryId.of(found.id),
      workspaceId: WorkspaceId.of(found.workspaceId),
      teamId: TeamId.of(found.teamId),
    });
  }
}
