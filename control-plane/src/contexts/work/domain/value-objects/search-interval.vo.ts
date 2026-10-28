import { InvalidSearchIntervalError } from '@work/domain/exceptions/invalid-search-interval.error';

const WRITTEN = /^(\d{1,6})([mhd])$/;

const MINUTE = 60_000;

const UNITS: Readonly<Record<string, number>> = {
  m: MINUTE,
  h: 60 * MINUTE,
  d: 24 * 60 * MINUTE,
};

const SHORTEST = 60 * MINUTE;

const LONGEST = 365 * 24 * 60 * MINUTE;

export class SearchInterval {
  private constructor(
    readonly text: string,
    readonly milliseconds: number,
  ) {}

  static of(raw: string): SearchInterval {
    const text = raw.trim();
    const written = WRITTEN.exec(text);

    if (!written) {
      throw new InvalidSearchIntervalError(
        'must be a whole number of minutes, hours or days, as in 90m, 12h or 7d',
      );
    }

    const [, amount, unit] = written as unknown as [string, string, string];
    const milliseconds = Number(amount) * (UNITS[unit] as number);

    if (milliseconds < SHORTEST || milliseconds > LONGEST) {
      throw new InvalidSearchIntervalError('must be from 1h to 365d');
    }

    return new SearchInterval(text, milliseconds);
  }

  isLongerThan(other: SearchInterval): boolean {
    return this.milliseconds > other.milliseconds;
  }

  equals(other: SearchInterval): boolean {
    return this.milliseconds === other.milliseconds;
  }
}
