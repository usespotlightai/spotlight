import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface PersonToolRuleRecord {
  readonly rule: PersonToolRule;
  readonly personId: UserId;
  readonly personName: string;
}

export class PersonToolRules {
  constructor(
    private readonly policies: PersonToolPolicyRepository,
    private readonly people: PersonReaderPort,
  ) {}

  async ruleFor(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
    tool: string,
  ): Promise<PersonToolRuleRecord | null> {
    const personId = owner.personId;

    if (!personId) {
      return null;
    }

    const policy = await this.policies.of(teamId, personId, integration);
    const rule = policy?.ruleFor(ToolName.of(tool));

    if (!rule || rule.allows) {
      return null;
    }

    return {
      rule,
      personId,
      personName: (await this.people.find(personId))?.name ?? '',
    };
  }
}
