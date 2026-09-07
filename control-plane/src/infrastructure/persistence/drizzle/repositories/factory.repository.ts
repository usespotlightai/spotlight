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

    return found ? toFactory(found) : null;
  }

  async find(id: FactoryId): Promise<Factory | null> {
    const [found] = await this.context.db
      .select()
      .from(factory)
      .where(eq(factory.id, id.value))
      .limit(1);

    return found ? toFactory(found) : null;
  }
}

const toFactory = (row: {
  id: string;
  workspaceId: string;
  teamId: string;
}): Factory =>
  Factory.of({
    id: FactoryId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
  });
