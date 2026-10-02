import { InvalidMoneyError } from '@work/domain/exceptions/invalid-money.error';
import { InvalidStationNameError } from '@work/domain/exceptions/invalid-station-name.error';
import { Money } from '@work/domain/value-objects/money.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

describe('Money', () => {
  it('holds an amount with what it is counted in', () => {
    const held = Money.of(7.33, 'USD');

    expect(held.amount).toBe(7.33);
    expect(held.currency).toBe('USD');
  });

  it('refuses an amount with nothing to count it in', () => {
    expect(() => Money.of(1, ' ')).toThrow(InvalidMoneyError);
  });

  it('reads nothing said as nothing spent', () => {
    expect(Money.maybe(null, 'USD')).toBeNull();
    expect(Money.maybe(1, null)).toBeNull();
  });

  it('adds what is counted the same way', () => {
    expect(Money.of(1, 'USD').plus(Money.of(0.5, 'USD')).amount).toBe(1.5);
  });

  it('refuses to add what is counted differently', () => {
    expect(() => Money.of(1, 'USD').plus(Money.of(1, 'EUR'))).toThrow(
      InvalidMoneyError,
    );
  });
});

describe('StationName.maybe', () => {
  it('reads back what was written, nothing where nothing was, and refuses what is no name', () => {
    expect(StationName.maybe('Implementation')?.value).toBe('Implementation');
    expect(StationName.maybe(null)).toBeNull();
    expect(() => StationName.maybe('x'.repeat(200))).toThrow(
      InvalidStationNameError,
    );
  });
});
