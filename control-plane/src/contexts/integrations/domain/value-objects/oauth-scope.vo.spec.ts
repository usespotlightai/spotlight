import { OAuthScope } from '@integrations/domain/value-objects/oauth-scope.vo';
import { describe, expect, it } from 'vitest';

describe('OAuthScope', () => {
  it('is one scope token', () => {
    expect(OAuthScope.of('chat:write').value).toBe('chat:write');
    expect(() => OAuthScope.of('chat:write repo')).toThrow();
    expect(() => OAuthScope.of('')).toThrow();
    expect(() => OAuthScope.of('"repo"')).toThrow();
  });
});
