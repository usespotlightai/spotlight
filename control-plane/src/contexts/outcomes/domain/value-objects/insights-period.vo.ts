import { InvalidInsightsPeriodError } from '@outcomes/domain/exceptions/invalid-insights-period.error';

export const INSIGHTS_PERIODS = ['7d', '30d', '90d'] as const;

export type InsightsPeriodName = (typeof INSIGHTS_PERIODS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

const DAYS: Readonly<Record<InsightsPeriodName, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const LONGEST_PERIOD: InsightsPeriodName = '90d';

const WEEK_DAYS = 7;

const MONTH_DAYS = 30;

export interface Window {
  readonly from: Date;
  readonly to: Date;
}

const startOfNextDay = (now: Date): Date =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

const daysBefore = (at: Date, days: number): Date =>
  new Date(at.getTime() - days * DAY_MS);

export const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

export const longestLookbackFrom = (now: Date): Date =>
  daysBefore(startOfNextDay(now), 2 * Math.max(...Object.values(DAYS)));

export const within = (window: Window, at: Date | null): boolean =>
  at !== null &&
  at.getTime() >= window.from.getTime() &&
  at.getTime() < window.to.getTime();

export class InsightsPeriod {
  private constructor(
    readonly name: InsightsPeriodName,
    readonly current: Window,
    readonly previous: Window,
  ) {}

  static of(raw: string, now: Date): InsightsPeriod {
    const name = INSIGHTS_PERIODS.find((each) => each === raw.trim());

    if (!name) {
      throw new InvalidInsightsPeriodError();
    }

    const to = startOfNextDay(now);
    const from = daysBefore(to, DAYS[name]);

    return new InsightsPeriod(
      name,
      { from, to },
      { from: daysBefore(from, DAYS[name]), to: from },
    );
  }

  static covering(at: Date, now: Date): InsightsPeriodName {
    return (
      INSIGHTS_PERIODS.find((name) =>
        within(InsightsPeriod.of(name, now).current, at),
      ) ?? LONGEST_PERIOD
    );
  }

  get days(): readonly string[] {
    return Array.from({ length: DAYS[this.name] }, (_, at) =>
      dayOf(new Date(this.current.from.getTime() + at * DAY_MS)),
    );
  }

  get lastWeek(): Window {
    return {
      from: daysBefore(this.current.to, WEEK_DAYS),
      to: this.current.to,
    };
  }

  get lastMonth(): Window {
    return {
      from: daysBefore(this.current.to, MONTH_DAYS),
      to: this.current.to,
    };
  }

  get lookback(): Window {
    return {
      from: new Date(
        Math.min(this.previous.from.getTime(), this.lastMonth.from.getTime()),
      ),
      to: this.current.to,
    };
  }
}
