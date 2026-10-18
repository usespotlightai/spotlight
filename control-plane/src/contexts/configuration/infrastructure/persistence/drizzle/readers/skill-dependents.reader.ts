import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import type { TeamDependentSource } from '@identity/application/ports/team-dependents.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleSkillDependents implements TeamDependentSource {
  constructor(private readonly context: DrizzleContext) {}

  async dependentsOf(teamId: TeamId): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ key: skillDefinition.key })
        .from(skillDefinition)
        .where(eq(skillDefinition.teamId, teamId.value))
        .orderBy(asc(skillDefinition.key))
    ).map((each) => `skill ${each.key}`);
  }
}
