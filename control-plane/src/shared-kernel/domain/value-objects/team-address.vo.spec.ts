import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { describe, expect, it } from 'vitest';

describe('TeamAddress', () => {
  it('names what a team owns by the team key and its own', () => {
    expect(TeamAddress.of('core', 'delivery').toString()).toBe('core/delivery');
  });

  it('reads back the address it writes', () => {
    expect(
      TeamAddress.parse('core/delivery').equals(
        TeamAddress.of('core', 'delivery'),
      ),
    ).toBe(true);
  });

  it.each([
    'core',
    'core/',
    '/delivery',
    'core/delivery/more',
    'Core/delivery',
  ])('rejects %j', (text) => {
    expect(() => TeamAddress.parse(text)).toThrow(InvalidIdentifierError);
  });
});
