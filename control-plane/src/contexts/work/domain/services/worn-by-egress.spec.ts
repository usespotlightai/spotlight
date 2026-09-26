import { wornByEgress } from '@work/domain/services/worn-by-egress';
import { describe, expect, it } from 'vitest';

describe('wornByEgress', () => {
  it('stands in for each secret an environment names, and says which it wears', () => {
    const worn = wornByEgress({
      LINEAR_API_KEY: 'secret.LINEAR_API_KEY',
      LINEAR_TEAM: 'core',
      AGAIN: 'secret.LINEAR_API_KEY',
    });

    expect(worn.env).toEqual({
      LINEAR_API_KEY: 'spotlight-egress:LINEAR_API_KEY',
      LINEAR_TEAM: 'core',
      AGAIN: 'spotlight-egress:LINEAR_API_KEY',
    });
    expect(worn.wears.map((each) => each.value)).toEqual(['LINEAR_API_KEY']);
  });

  it('leaves an environment that names no secret as it is', () => {
    const worn = wornByEgress({ MODE: 'secret', NOTE: 'secret.lower' });

    expect(worn.env).toEqual({ MODE: 'secret', NOTE: 'secret.lower' });
    expect(worn.wears).toEqual([]);
  });
});
