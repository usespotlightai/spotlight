import { InvalidMoneyError } from '@runs/domain/exceptions/invalid-money.error';
import { Money } from '@runs/domain/value-objects/money.vo';
import { InvalidStationNameError } from '@shared-kernel/domain/exceptions/invalid-station-name.error';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

describe('Money', () => {
  it('keeps an amount with what it is counted in', () => {
    const money = Money.of(7.33, 'USD');

    expect(money.amount).toBe(7.33);
    expect(money.currency).toBe('USD');
  });

  it('rejects an amount with nothing to count it in', () => {
    expect(() => Money.of(1, ' ')).toThrow(InvalidMoneyError);
  });

  it('counts in the ISO code of its currency', () => {
    expect(Money.of(1, 'usd').currency).toBe('USD');
    expect(() => Money.of(1, 'credits')).toThrow(InvalidMoneyError);
    expect(() => Money.maybe(1, 'credits')).toThrow(InvalidMoneyError);
  });

  it('reads nothing said as nothing spent', () => {
    expect(Money.maybe(null, 'USD')).toBeNull();
    expect(Money.maybe(1, null)).toBeNull();
  });

  it('adds what is counted the same way', () => {
    expect(Money.of(1, 'USD').plus(Money.of(0.5, 'USD')).amount).toBe(1.5);
  });

  it('does not add what is counted differently', () => {
    expect(() => Money.of(1, 'USD').plus(Money.of(1, 'EUR'))).toThrow(
      InvalidMoneyError,
    );
  });
});

describe('StationName.maybe', () => {
  it('reads back what was written, nothing where nothing was, and rejects what is no name', () => {
    expect(StationName.maybe('Implementation')?.value).toBe('Implementation');
    expect(StationName.maybe(null)).toBeNull();
    expect(() => StationName.maybe('x'.repeat(200))).toThrow(
      InvalidStationNameError,
    );
  });
});
