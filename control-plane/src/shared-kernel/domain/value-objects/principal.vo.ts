import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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

export interface TokenGrant {
  readonly tokenKey: string;
}

export class TokenPrincipal {
  readonly kind = 'token' as const;

  private constructor(
    readonly grant: TokenGrant,
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
  ) {}

  static of(input: {
    grant: TokenGrant;
    workspaceId: WorkspaceId;
    issuedBy: UserId;
  }): TokenPrincipal {
    return new TokenPrincipal(input.grant, input.workspaceId, input.issuedBy);
  }

  toString(): string {
    return `token:${this.grant.tokenKey}`;
  }
}

export type Principal = PersonPrincipal | TokenPrincipal;
