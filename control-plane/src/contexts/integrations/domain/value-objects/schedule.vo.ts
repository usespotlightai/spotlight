import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import type { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';

export type ScheduleTurn = 'starts' | 'due' | 'waits';

export class Schedule {
  private constructor(
    readonly cron: CronExpression,
    readonly action: string,
  ) {}

  static of(input: { cron: CronExpression; action: string }): Schedule {
    return new Schedule(input.cron, input.action);
  }

  equals(other: Schedule): boolean {
    return this.cron.equals(other.cron) && this.action === other.action;
  }

  turn(lastRan: Date | null, now: Date, calendar: CronCalendar): ScheduleTurn {
    if (lastRan === null) {
      return 'starts';
    }

    return this.cron.nextAfter(lastRan, calendar).getTime() <= now.getTime()
      ? 'due'
      : 'waits';
  }
}
