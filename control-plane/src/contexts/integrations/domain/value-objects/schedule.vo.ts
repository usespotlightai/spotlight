import type { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';

export type ScheduleTurn = 'starts' | 'due' | 'waits';

export class Schedule {
  private constructor(
    readonly cron: CronExpression,
    readonly does: string,
  ) {}

  static of(input: { cron: CronExpression; does: string }): Schedule {
    return new Schedule(input.cron, input.does);
  }

  turn(lastRan: Date | null, now: Date): ScheduleTurn {
    if (lastRan === null) {
      return 'starts';
    }

    return this.cron.nextAfter(lastRan).getTime() <= now.getTime()
      ? 'due'
      : 'waits';
  }
}
