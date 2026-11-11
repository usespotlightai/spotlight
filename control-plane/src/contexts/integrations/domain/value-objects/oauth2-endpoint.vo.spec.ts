import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
import { describe, expect, it } from 'vitest';

describe('OAuth2Endpoint', () => {
  it('is a web address', () => {
    expect(OAuth2Endpoint.of('https://mcp.example/register').value).toBe(
      'https://mcp.example/register',
    );
    expect(() => OAuth2Endpoint.of('mcp.example/register')).toThrow(
      InvalidIntegrationPartError,
    );
    expect(() => OAuth2Endpoint.of('file:///etc/passwd')).toThrow(
      InvalidIntegrationPartError,
    );
  });
});
