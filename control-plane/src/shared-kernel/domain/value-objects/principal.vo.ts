import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class PersonPrincipal {
  readonly kind = 'person' as const;

  private constructor(readonly userId: UserId) {}

  static of(userId: UserId): PersonPrincipal {
    return new PersonPrincipal(userId);
  }

  toString(): string {
    return `person:${this.userId.value}`;
  }
}

export class TokenPrincipal {
  readonly kind = 'token' as const;

  private constructor(
    readonly tokenId: WorkspaceTokenId,
    readonly workspaceId: WorkspaceId,
    readonly scopes: TokenScopes,
    readonly userId: UserId,
    readonly issuedByTrustId: WorkspaceTokenTrustId | null,
  ) {}

  static of(input: {
    tokenId: WorkspaceTokenId;
    workspaceId: WorkspaceId;
    scopes: TokenScopes;
    issuedBy: UserId;
    issuedByTrustId?: WorkspaceTokenTrustId | null;
  }): TokenPrincipal {
    return new TokenPrincipal(
      input.tokenId,
      input.workspaceId,
      input.scopes,
      input.issuedBy,
      input.issuedByTrustId ?? null,
    );
  }

  toString(): string {
    return `token:${this.tokenId.value}`;
  }
}

export type Principal = PersonPrincipal | TokenPrincipal;
