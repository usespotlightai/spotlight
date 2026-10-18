import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';

export const HarnessProfileShapeMapper = {
  toShape(parsed: ParsedProfile): HarnessProfileShape {
    return {
      key: parsed.key.value,
      rules: parsed.settings.rules.map((rule) => ({
        decision: rule.decision,
        kind: rule.kind,
        pattern: rule.pattern,
      })),
      mcpServers: HarnessProfileMapper.servers(parsed.settings),
      native: parsed.settings.native,
    };
  },
};
