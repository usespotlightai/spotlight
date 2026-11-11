import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { IntegrationLogo } from '@integrations/domain/value-objects/integration-logo.vo';
import { describe, expect, it } from 'vitest';

describe('IntegrationLogo', () => {
  it('is a base64 image data URI', () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`;

    expect(IntegrationLogo.of(svg).value).toBe(svg);
    expect(IntegrationLogo.of('data:image/png;base64,iVBORw0KGgo=').value).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('is an https address', () => {
    expect(IntegrationLogo.of('https://example.com/logo.svg').value).toBe(
      'https://example.com/logo.svg',
    );
  });

  it('refuses any other address or document', () => {
    expect(() => IntegrationLogo.of('http://example.com/logo.svg')).toThrow(
      InvalidIntegrationPartError,
    );
    expect(() => IntegrationLogo.of('javascript:alert(1)')).toThrow(
      InvalidIntegrationPartError,
    );
    expect(() => IntegrationLogo.of('data:text/html;base64,PGI+')).toThrow(
      InvalidIntegrationPartError,
    );
    expect(() => IntegrationLogo.of('data:image/svg+xml,<svg/>')).toThrow(
      InvalidIntegrationPartError,
    );
    expect(() => IntegrationLogo.of('<svg/>')).toThrow(
      InvalidIntegrationPartError,
    );
  });

  it('refuses a logo that is too long', () => {
    expect(() =>
      IntegrationLogo.of(`data:image/png;base64,${'A'.repeat(70_000)}`),
    ).toThrow(InvalidIntegrationPartError);
  });
});
