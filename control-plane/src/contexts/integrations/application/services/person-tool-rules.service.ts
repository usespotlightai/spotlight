import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
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
    source: SourceKey,
    holder: ConnectionHolder,
    tool: string,
  ): Promise<PersonToolRuleRecord | null> {
    const personId = holder.personId;

    if (!personId) {
      return null;
    }

    const policy = await this.policies.of(teamId, personId, source);
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
