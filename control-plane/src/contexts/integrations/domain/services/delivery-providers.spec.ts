import { DeliveryProviders } from '@integrations/domain/services/delivery-providers';
import { describe, expect, it } from 'vitest';

describe('DeliveryProviders', () => {
  it('gives a built-in provider the deliveries addressed to no team', () => {
    expect(
      DeliveryProviders.ownerOf({ addressedToTeam: false, builtIn: true }),
    ).toBe('built-in');
  });

  it('never lets a team file take the deliveries of a built-in provider', () => {
    expect(
      DeliveryProviders.ownerOf({ addressedToTeam: true, builtIn: true }),
    ).toBe('nobody');
  });

  it('gives a team its own provider, and nobody a delivery no one provides', () => {
    expect(
      DeliveryProviders.ownerOf({ addressedToTeam: true, builtIn: false }),
    ).toBe('team');
    expect(
      DeliveryProviders.ownerOf({ addressedToTeam: false, builtIn: false }),
    ).toBe('nobody');
  });
});
