import { inspect } from 'node:util';
import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import { describe, expect, it } from 'vitest';

describe('WornSecrets', () => {
  const worn = WornSecrets.of([
    { name: 'authorization', value: 'Bearer lin_api_1' },
  ]);

  it('puts each header on the request, over any the request wrote', () => {
    const headers: Record<string, string> = {
      Authorization: 'Bearer forged',
      accept: 'application/json',
    };

    worn.applyTo(headers);

    expect(headers).toEqual({
      authorization: 'Bearer lin_api_1',
      accept: 'application/json',
    });
  });

  it('never says what it wears', () => {
    expect(JSON.stringify({ worn })).not.toContain('lin_api_1');
    expect(inspect(worn)).not.toContain('lin_api_1');
    expect(String(worn)).not.toContain('lin_api_1');
  });
});
