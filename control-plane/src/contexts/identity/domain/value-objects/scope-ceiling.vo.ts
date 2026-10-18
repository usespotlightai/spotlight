import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';

type ScopeLevel =
  | { readonly kind: 'unlimited' }
  | { readonly kind: 'scoped'; readonly scopes: TokenScopes };

export class ScopeCeiling {
  static readonly unlimited = new ScopeCeiling({ kind: 'unlimited' });

  private constructor(private readonly level: ScopeLevel) {}

  static of(principal: Principal): ScopeCeiling {
    return principal.kind === 'token'
      ? ScopeCeiling.withScopes(principal.scopes)
      : ScopeCeiling.unlimited;
  }

  static withScopes(scopes: TokenScopes): ScopeCeiling {
    return new ScopeCeiling({ kind: 'scoped', scopes });
  }

  allows(scopes: TokenScopes): boolean {
    return this.level.kind === 'unlimited' || this.level.scopes.covers(scopes);
  }
}
