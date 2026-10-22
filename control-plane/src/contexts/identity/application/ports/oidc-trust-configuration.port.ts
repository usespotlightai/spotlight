import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const OIDC_TRUST_CONFIGURATION = Symbol('OIDC_TRUST_CONFIGURATION');

export interface OidcTrustView {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly claims: Readonly<Record<string, string>>;
  readonly scopes: readonly string[];
  readonly lifetimeMinutes: number;
}

export interface OidcTrustConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<readonly OidcTrustView[]>;

  withId(id: string): Promise<OidcTrustView | null>;
}
