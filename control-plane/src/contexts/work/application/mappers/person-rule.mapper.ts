import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { PersonRuleDto } from '@work/application/ports/integration-tool-calls.port';
import type { PersonRule } from '@work/domain/services/stricter-rule';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';

export const PersonRuleMapper = {
  toRule(dto: PersonRuleDto): PersonRule {
    return {
      rule: ToolRule.of(dto.rule),
      personId: UserId.of(dto.personId),
      personName: dto.personName,
    };
  },
};
