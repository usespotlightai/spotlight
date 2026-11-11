import type { ReadyProfileShape } from '@runs/application/contracts/harness-profile.contract';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';

export const ReadyProfileMapper = {
  toReady(ready: ReadyProfileShape): ReadyProfile {
    return {
      key: ready.key,
      rules: ready.rules.map((rule) => ({
        decision: rule.decision,
        kind: rule.kind,
        pattern: rule.pattern,
      })),
      mcpServers: ready.mcpServers.map((server) => ({
        name: server.name,
        command: server.command,
        args: [...server.args],
        env: { ...server.env },
      })),
      native: ready.native,
      injectedSecrets: [...ready.injectedSecrets],
    };
  },
};
