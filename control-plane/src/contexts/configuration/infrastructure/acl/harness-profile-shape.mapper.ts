import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { ReadProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';

export const HarnessProfileShapeMapper = {
  toShape(read: ReadProfile): HarnessProfileShape {
    return {
      key: read.key.value,
      rules: read.settings.rules.map((rule) => ({
        decision: rule.decision,
        kind: rule.kind,
        pattern: rule.pattern,
      })),
      mcpServers: HarnessProfileMapper.servers(read.settings),
      native: read.settings.native,
    };
  },
};
