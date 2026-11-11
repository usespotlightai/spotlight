import { OAuthScope } from '@integrations/domain/value-objects/oauth-scope.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('OAuthScope', () => {
  it('is one scope token', () => {
    expect(OAuthScope.of('chat:write').value).toBe('chat:write');
    expect(() => OAuthScope.of('chat:write repo')).toThrow(
      InvalidIdentifierError,
    );
    expect(() => OAuthScope.of('')).toThrow(InvalidIdentifierError);
    expect(() => OAuthScope.of('"repo"')).toThrow(InvalidIdentifierError);
  });
});
