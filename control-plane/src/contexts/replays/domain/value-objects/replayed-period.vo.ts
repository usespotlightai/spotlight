import { InvalidReplayedPeriodError } from '@replays/domain/exceptions/invalid-replayed-period.error';

export const REPLAYED_PERIODS = ['7d', '30d', '90d'] as const;

export type ReplayedPeriodName = (typeof REPLAYED_PERIODS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

const DAYS: Readonly<Record<ReplayedPeriodName, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const startOfNextDay = (now: Date): Date =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

export class ReplayedPeriod {
  private constructor(
    readonly name: ReplayedPeriodName,
    readonly from: Date,
    readonly to: Date,
  ) {}

  static of(raw: string, now: Date): ReplayedPeriod {
    const name = REPLAYED_PERIODS.find((each) => each === raw.trim());

    if (!name) {
      throw new InvalidReplayedPeriodError();
    }

    const to = startOfNextDay(now);

    return new ReplayedPeriod(
      name,
      new Date(to.getTime() - DAYS[name] * DAY_MS),
      to,
    );
  }

  includes(at: Date): boolean {
    return (
      at.getTime() >= this.from.getTime() && at.getTime() < this.to.getTime()
    );
  }
}
