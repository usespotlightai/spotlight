import type { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import type { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import type { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  type TokenGrant,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IssuedTokenGrant implements TokenGrant {
  private constructor(
    readonly tokenId: WorkspaceTokenId,
    readonly scopes: TokenScopes,
    readonly issuedByTrustId: OidcTrustId | null,
  ) {}

  static principal(input: {
    tokenId: WorkspaceTokenId;
    workspaceId: WorkspaceId;
    scopes: TokenScopes;
    issuedBy: UserId;
    issuedByTrustId?: OidcTrustId | null;
  }): TokenPrincipal {
    return TokenPrincipal.of({
      grant: new IssuedTokenGrant(
        input.tokenId,
        input.scopes,
        input.issuedByTrustId ?? null,
      ),
      workspaceId: input.workspaceId,
      issuedBy: input.issuedBy,
    });
  }

  static of(principal: TokenPrincipal): IssuedTokenGrant {
    if (!(principal.grant instanceof IssuedTokenGrant)) {
      throw new InconsistentStateError(
        'token principal',
        'carries a grant Identity did not issue',
      );
    }

    return principal.grant;
  }

  get tokenKey(): string {
    return this.tokenId.value;
  }
}
