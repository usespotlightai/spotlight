import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';

type Reach =
  | { readonly kind: 'unlimited' }
  | { readonly kind: 'scoped'; readonly scopes: TokenScopes };

export class Grantor {
  static readonly unlimited = new Grantor({ kind: 'unlimited' });

  private constructor(private readonly reach: Reach) {}

  static of(principal: Principal): Grantor {
    return principal.kind === 'token'
      ? Grantor.holding(principal.scopes)
      : Grantor.unlimited;
  }

  static holding(scopes: TokenScopes): Grantor {
    return new Grantor({ kind: 'scoped', scopes });
  }

  covers(scopes: TokenScopes): boolean {
    return this.reach.kind === 'unlimited' || this.reach.scopes.covers(scopes);
  }
}
