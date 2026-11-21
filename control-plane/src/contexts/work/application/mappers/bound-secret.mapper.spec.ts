import { BoundSecretMapper } from '@work/application/mappers/bound-secret.mapper';
import { describe, expect, it } from 'vitest';

describe('BoundSecretMapper', () => {
  it('keeps what a run sends for each binding, and whether the secret awaits a value', () => {
    const bound = BoundSecretMapper.toBound({
      name: 'STAGING_VIEWER',
      bindings: [
        {
          host: 'staging.example.com',
          location: 'header',
          name: 'authorization',
          sent: 'Bearer spotlight-egress:STAGING_VIEWER',
        },
      ],
      awaitingValue: true,
      entersSandbox: true,
    });

    expect(bound.name.value).toBe('STAGING_VIEWER');
    expect(bound.awaitingValue).toBe(true);
    expect(bound.entersSandbox).toBe(true);
    expect(bound.bindings).toEqual([
      {
        host: 'staging.example.com',
        location: 'header',
        name: 'authorization',
        sent: 'Bearer spotlight-egress:STAGING_VIEWER',
      },
    ]);
  });
});
