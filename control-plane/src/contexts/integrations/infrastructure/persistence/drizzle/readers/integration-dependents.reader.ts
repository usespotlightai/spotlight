import type { TeamDependentSource } from '@identity/application/ports/team-dependents.port';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationDependents implements TeamDependentSource {
  constructor(private readonly context: DrizzleContext) {}

  async dependentsOf(teamId: TeamId): Promise<readonly string[]> {
    const [integrations, hooks] = await Promise.all([
      this.context.db
        .select({ integration: integrationDefinition.integration })
        .from(integrationDefinition)
        .where(eq(integrationDefinition.teamId, teamId.value))
        .orderBy(asc(integrationDefinition.integration)),
      this.context.db
        .select({ key: hookDefinition.key })
        .from(hookDefinition)
        .where(eq(hookDefinition.teamId, teamId.value))
        .orderBy(asc(hookDefinition.key)),
    ]);

    return [
      ...integrations.map((each) => `integration ${each.integration}`),
      ...hooks.map((each) => `hook ${each.key}`),
    ];
  }
}
