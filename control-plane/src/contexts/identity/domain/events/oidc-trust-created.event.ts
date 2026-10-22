import type { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class OidcTrustCreated implements ConfigurationChanged {
  readonly kind = 'oidc-trust.created';

  constructor(
    readonly trustId: OidcTrustId,
    readonly workspaceId: WorkspaceId,
    readonly key: OidcTrustKey,
    readonly change: ConfigurationChange,
  ) {}
}
