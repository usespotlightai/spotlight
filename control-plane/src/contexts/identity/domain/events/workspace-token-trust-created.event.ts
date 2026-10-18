import type { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class WorkspaceTokenTrustCreated implements ConfigurationChanged {
  readonly kind = 'workspace-token-trust.created';

  constructor(
    readonly trustId: WorkspaceTokenTrustId,
    readonly workspaceId: WorkspaceId,
    readonly key: TokenTrustKey,
    readonly change: ConfigurationChange,
  ) {}
}
