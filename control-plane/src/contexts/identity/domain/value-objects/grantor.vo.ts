import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';

type ScopeLevel =
  | { readonly kind: 'unlimited' }
  | { readonly kind: 'scoped'; readonly scopes: TokenScopes };

export class Grantor {
  static readonly unlimited = new Grantor({ kind: 'unlimited' });

  private constructor(private readonly level: ScopeLevel) {}

  static of(principal: Principal): Grantor {
    return principal.kind === 'token'
      ? Grantor.withScopes(principal.scopes)
      : Grantor.unlimited;
  }

  static withScopes(scopes: TokenScopes): Grantor {
    return new Grantor({ kind: 'scoped', scopes });
  }

  covers(scopes: TokenScopes): boolean {
    return this.level.kind === 'unlimited' || this.level.scopes.covers(scopes);
  }
}
