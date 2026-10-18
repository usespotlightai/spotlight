import { PersonToolRules } from '@integrations/application/services/person-tool-rules.service';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { PersonToolPolicyVersionConflictError } from '@integrations/domain/exceptions/person-tool-policy-version-conflict.error';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const keyOf = (
  teamId: TeamId,
  personId: UserId,
  integration: IntegrationKey,
): string => [teamId.value, personId.value, integration.value].join(':');

export class InMemoryPersonToolPolicies implements PersonToolPolicyRepository {
  readonly stored = new Map<string, PersonToolPolicy>();

  async of(
    teamId: TeamId,
    personId: UserId,
    integration: IntegrationKey,
  ): Promise<PersonToolPolicy | null> {
    return this.stored.get(keyOf(teamId, personId, integration)) ?? null;
  }

  async ofPerson(
    teamId: TeamId,
    personId: UserId,
  ): Promise<readonly PersonToolPolicy[]> {
    return [...this.stored.values()].filter(
      (each) => each.teamId.equals(teamId) && each.personId.equals(personId),
    );
  }

  async save(policy: PersonToolPolicy): Promise<void> {
    const key = keyOf(policy.teamId, policy.personId, policy.integration);

    if ((this.stored.get(key)?.version ?? 0) !== policy.version) {
      throw new PersonToolPolicyVersionConflictError(policy.integration.value);
    }

    this.stored.set(
      key,
      PersonToolPolicy.rehydrate({
        teamId: policy.teamId,
        personId: policy.personId,
        integration: policy.integration,
        rules: policy.rules,
        version: policy.version + 1,
      }),
    );
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const [key, each] of this.stored) {
      if (each.teamId.equals(teamId)) {
        this.stored.delete(key);
      }
    }
  }
}

export const personRulesFrom = (
  policies: PersonToolPolicyRepository = new InMemoryPersonToolPolicies(),
  names: Readonly<Record<string, string>> = {},
): PersonToolRules =>
  new PersonToolRules(policies, {
    find: async (id) =>
      names[id.value]
        ? { id: id.value, name: names[id.value] ?? '', image: null }
        : null,
    findMany: async () => new Map(),
  });
