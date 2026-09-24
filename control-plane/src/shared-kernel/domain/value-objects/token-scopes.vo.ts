import { InvalidTokenScopeError } from '@shared-kernel/domain/exceptions/invalid-token-scope.error';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';

export class TokenScopes {
  private constructor(readonly all: readonly TokenScope[]) {}

  static of(scopes: readonly TokenScope[]): TokenScopes {
    const distinct = new Set(scopes.map((each) => each.value));

    if (distinct.size !== scopes.length) {
      throw new InvalidTokenScopeError('name each scope once');
    }

    if (!scopes.some((each) => each.isLadder)) {
      throw new InvalidTokenScopeError(
        'include read, plan or configure; secrets is granted beside one of them',
      );
    }

    return new TokenScopes(
      TokenScope.all.filter((each) => distinct.has(each.value)),
    );
  }

  static named(raw: readonly string[]): TokenScopes {
    return TokenScopes.of(raw.map((each) => TokenScope.of(each)));
  }

  allow(scope: TokenScope): boolean {
    return this.all.some((each) => each.grants(scope));
  }

  equals(other: TokenScopes): boolean {
    return (
      this.all.length === other.all.length &&
      this.all.every((each, at) => other.all[at]?.equals(each))
    );
  }

  toString(): string {
    return this.all.map((each) => each.value).join(', ');
  }
}
