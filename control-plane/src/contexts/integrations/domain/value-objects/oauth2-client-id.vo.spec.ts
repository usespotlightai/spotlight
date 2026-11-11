import { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('OAuth2ClientId', () => {
  it('is never empty', () => {
    expect(() => OAuth2ClientId.of(' ')).toThrow(InvalidIdentifierError);
    expect(OAuth2ClientId.parsed(' ')).toBeNull();
    expect(OAuth2ClientId.of('client-1').value).toBe('client-1');
  });
});
