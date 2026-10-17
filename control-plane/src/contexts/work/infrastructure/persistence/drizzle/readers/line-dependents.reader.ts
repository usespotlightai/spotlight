import type { TeamDependentSource } from '@identity/application/ports/team-dependents.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { line } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleLineDependents implements TeamDependentSource {
  constructor(private readonly context: DrizzleContext) {}

  async dependentsOf(teamId: TeamId): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ key: line.key })
        .from(line)
        .where(eq(line.teamId, teamId.value))
        .orderBy(asc(line.key))
    ).map((each) => `line ${each.key}`);
  }
}
