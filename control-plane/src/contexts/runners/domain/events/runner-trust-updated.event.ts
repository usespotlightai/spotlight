import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerTrustUpdated implements ConfigurationChanged {
  readonly kind = 'runner-trust.updated';

  constructor(
    readonly trustId: RunnerTrustId,
    readonly workspaceId: WorkspaceId,
    readonly key: TrustKey,
    readonly change: ConfigurationChange,
  ) {}
}
