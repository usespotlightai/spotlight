import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TOKEN_TRUST_CONFIGURATION = Symbol('TOKEN_TRUST_CONFIGURATION');

export interface TokenTrustView {
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

export interface TokenTrustConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<readonly TokenTrustView[]>;

  withId(id: string): Promise<TokenTrustView | null>;
}
