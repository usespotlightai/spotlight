import type {
  HookRecord,
  HookResourcesPort,
} from '@integrations/application/ports/hook-resources.port';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

type Row = typeof hookDefinition.$inferSelect;

const recordOf = (row: Row): HookRecord => ({
  id: row.id,
  teamId: TeamId.of(row.teamId),
  key: row.key,
  version: row.version,
  definition: row.definition,
});

@Injectable()
export class DrizzleHookResources implements HookResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<HookRecord | null> {
    return this.first(eq(hookDefinition.id, id));
  }

  at(teamId: TeamId, key: string): Promise<HookRecord | null> {
    return this.first(
      and(eq(hookDefinition.teamId, teamId.value), eq(hookDefinition.key, key)),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly HookRecord[]> {
    return (
      await this.context.db
        .select()
        .from(hookDefinition)
        .where(eq(hookDefinition.teamId, teamId.value))
        .orderBy(asc(hookDefinition.key))
    ).map(recordOf);
  }

  private async first(where: SQL | undefined): Promise<HookRecord | null> {
    const [found] = await this.context.db
      .select()
      .from(hookDefinition)
      .where(where)
      .limit(1);

    return found ? recordOf(found) : null;
  }
}
