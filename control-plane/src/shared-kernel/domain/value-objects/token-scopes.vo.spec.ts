import { InvalidTokenScopeError } from '@shared-kernel/domain/exceptions/invalid-token-scope.error';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { describe, expect, it } from 'vitest';

const allowed = (scopes: readonly string[]) => {
  const granted = TokenScopes.named(scopes);

  return TokenScope.all.filter((each) => granted.allow(each)).map(String);
};

describe('TokenScopes', () => {
  it.each([
    [['read'], ['read']],
    [['plan'], ['read', 'plan']],
    [['configure'], ['read', 'plan', 'configure']],
    [
      ['read', 'secrets'],
      ['read', 'secrets'],
    ],
    [
      ['configure', 'secrets'],
      ['read', 'plan', 'configure', 'secrets'],
    ],
    [
      ['read', 'runners'],
      ['read', 'runners'],
    ],
    [
      ['configure', 'secrets', 'runners'],
      ['read', 'plan', 'configure', 'secrets', 'runners'],
    ],
    [
      ['configure', 'trusts'],
      ['read', 'plan', 'configure', 'trusts'],
    ],
  ])('lets %j do everything below it on the ladder: %j', (scopes, allows) => {
    expect(allowed(scopes)).toEqual(allows);
  });

  it.each([
    [['secrets']],
    [['runners']],
    [['trusts']],
    [['secrets', 'runners']],
  ])('refuses %j granted without a rung of the ladder', (scopes) => {
    expect(() => TokenScopes.named(scopes)).toThrow(InvalidTokenScopeError);
  });

  it('refuses a scope named twice', () => {
    expect(() => TokenScopes.named(['read', 'read'])).toThrow(
      /name each scope once/,
    );
  });

  it('is the same set whatever order it was named in', () => {
    expect(
      TokenScopes.named(['secrets', 'configure']).equals(
        TokenScopes.named(['configure', 'secrets']),
      ),
    ).toBe(true);
  });
});
