import { injectedByEgress } from '@work/domain/services/injected-by-egress';
import { describe, expect, it } from 'vitest';

describe('injectedByEgress', () => {
  it('puts a stand-in for each secret an environment names, and says which secrets egress injects', () => {
    const injected = injectedByEgress({
      LINEAR_API_KEY: 'secret.LINEAR_API_KEY',
      LINEAR_TEAM: 'core',
      AGAIN: 'secret.LINEAR_API_KEY',
    });

    expect(injected.env).toEqual({
      LINEAR_API_KEY: 'spotlight-egress:LINEAR_API_KEY',
      LINEAR_TEAM: 'core',
      AGAIN: 'spotlight-egress:LINEAR_API_KEY',
    });
    expect(injected.injectedSecrets.map((each) => each.value)).toEqual([
      'LINEAR_API_KEY',
    ]);
  });

  it('leaves an environment that names no secret as it is', () => {
    const injected = injectedByEgress({ MODE: 'secret', NOTE: 'secret.lower' });

    expect(injected.env).toEqual({ MODE: 'secret', NOTE: 'secret.lower' });
    expect(injected.injectedSecrets).toEqual([]);
  });
});
