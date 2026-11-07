import type { PersonToolRulesPort } from '@integrations/application/ports/person-tool-rules.port';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { personToolPolicy } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzlePersonToolRules implements PersonToolRulesPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofPerson(
    teamId: TeamId,
    personId: UserId,
  ): Promise<ReadonlyMap<string, PersonToolRule>> {
    const rows = await this.context.db
      .select({ rules: personToolPolicy.rules })
      .from(personToolPolicy)
      .where(
        and(
          eq(personToolPolicy.teamId, teamId.value),
          eq(personToolPolicy.personId, personId.value),
        ),
      );

    return new Map(
      rows.flatMap((row) =>
        Object.entries(row.rules).map(
          ([tool, rule]) => [tool, PersonToolRule.of(rule)] as const,
        ),
      ),
    );
  }
}
