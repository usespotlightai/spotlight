import type {
  IdentityResourcesPort,
  OidcTrustRecord,
} from '@identity/application/ports/identity-resources.port';
import type {
  OidcTrustConfigurationPort,
  OidcTrustView,
} from '@identity/application/ports/oidc-trust-configuration.port';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const configured = (trust: OidcTrustRecord): OidcTrustView => ({
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

export class OidcTrustConfiguration implements OidcTrustConfigurationPort {
  constructor(private readonly resources: IdentityResourcesPort) {}

  async in(workspaceId: WorkspaceId): Promise<readonly OidcTrustView[]> {
    return (await this.resources.oidcTrustsIn(workspaceId)).map(configured);
  }

  async withId(id: string): Promise<OidcTrustView | null> {
    const record = await this.resources.oidcTrustWithId(OidcTrustId.of(id));

    return record ? configured(record) : null;
  }
}
