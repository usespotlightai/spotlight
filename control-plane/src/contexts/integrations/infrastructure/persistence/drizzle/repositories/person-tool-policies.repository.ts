import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { PersonToolPolicyVersionConflictError } from '@integrations/domain/exceptions/person-tool-policy-version-conflict.error';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { personToolPolicy } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof personToolPolicy.$inferSelect;

const rehydrate = (row: Row): PersonToolPolicy =>
  PersonToolPolicy.rehydrate({
    teamId: TeamId.of(row.teamId),
    personId: UserId.of(row.personId),
    integration: IntegrationKey.of(row.integration),
    rules: new Map(
      Object.entries(row.rules).map(([tool, rule]) => [
        tool,
        PersonToolRule.of(rule),
      ]),
    ),
    version: row.version,
  });

export class DrizzlePersonToolPolicies implements PersonToolPolicyRepository {
  constructor(private readonly context: DrizzleContext) {}

  async of(
    teamId: TeamId,
    personId: UserId,
    integration: IntegrationKey,
  ): Promise<PersonToolPolicy | null> {
    const [found] = await this.context.db
      .select()
      .from(personToolPolicy)
      .where(
        and(
          eq(personToolPolicy.teamId, teamId.value),
          eq(personToolPolicy.personId, personId.value),
          eq(personToolPolicy.integration, integration.value),
        ),
      )
      .limit(1);

    return found ? rehydrate(found) : null;
  }

  async ofPerson(
    teamId: TeamId,
    personId: UserId,
  ): Promise<readonly PersonToolPolicy[]> {
    const rows = await this.context.db
      .select()
      .from(personToolPolicy)
      .where(
        and(
          eq(personToolPolicy.teamId, teamId.value),
          eq(personToolPolicy.personId, personId.value),
        ),
      );

    return rows.map(rehydrate);
  }

  async save(policy: PersonToolPolicy): Promise<void> {
    const rules = Object.fromEntries(
      [...policy.rules].map(([tool, rule]) => [tool, rule.name]),
    );

    const saved = policy.isNew
      ? await this.context.db
          .insert(personToolPolicy)
          .values({
            teamId: policy.teamId.value,
            personId: policy.personId.value,
            integration: policy.integration.value,
            rules,
          })
          .onConflictDoNothing()
          .returning({ integration: personToolPolicy.integration })
      : await this.context.db
          .update(personToolPolicy)
          .set({ rules, version: policy.version + 1 })
          .where(
            and(
              eq(personToolPolicy.teamId, policy.teamId.value),
              eq(personToolPolicy.personId, policy.personId.value),
              eq(personToolPolicy.integration, policy.integration.value),
              eq(personToolPolicy.version, policy.version),
            ),
          )
          .returning({ integration: personToolPolicy.integration });

    if (saved.length === 0) {
      throw new PersonToolPolicyVersionConflictError(policy.integration.value);
    }
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(personToolPolicy)
      .where(eq(personToolPolicy.teamId, teamId.value));
  }
}
