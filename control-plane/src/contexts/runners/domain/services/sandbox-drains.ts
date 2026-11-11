import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export const sandboxesToDrainOn = (
  host: RunnerHost,
  live: readonly Sandbox[],
): readonly SandboxId[] => {
  const kept = live.filter((sandbox) => sandbox.keptBy(host));

  return host.sandboxes.sandboxes.filter(
    (reported) => !kept.some((sandbox) => sandbox.id.equals(reported)),
  );
};
