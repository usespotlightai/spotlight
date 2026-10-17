import type {
  IdentityResourcesPort,
  WorkspaceTokenTrustRecord,
} from '@identity/application/ports/identity-resources.port';
import type {
  TokenTrustConfigurationPort,
  TokenTrustView,
} from '@identity/application/ports/token-trust-configuration.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

const configured = (trust: WorkspaceTokenTrustRecord): TokenTrustView => ({
  id: trust.id.value,
  address: trust.key,
  workspaceId: trust.workspaceId,
  key: trust.key,
  issuer: trust.issuer,
  audience: trust.audience,
  subject: trust.subject,
  claims: { ...trust.claims },
  scopes: [...trust.scopes],
  lifetimeMinutes: trust.lifetimeMinutes,
});

export class TokenTrustConfiguration implements TokenTrustConfigurationPort {
  constructor(private readonly resources: IdentityResourcesPort) {}

  async in(workspaceId: WorkspaceId): Promise<readonly TokenTrustView[]> {
    return (await this.resources.tokenTrustsIn(workspaceId)).map(configured);
  }

  async withId(id: string): Promise<TokenTrustView | null> {
    const kept = await this.resources.tokenTrustWithId(
      WorkspaceTokenTrustId.of(id),
    );

    return kept ? configured(kept) : null;
  }
}
