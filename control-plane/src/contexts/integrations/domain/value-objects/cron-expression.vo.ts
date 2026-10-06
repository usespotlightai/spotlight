import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { CronCalendar } from '@integrations/domain/services/cron-calendar';

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class CronExpression {
  private constructor(
    readonly value: string,
    private readonly calendar: CronCalendar,
  ) {}

  static of(raw: string, calendar: CronCalendar): CronExpression {
    const value = raw.trim();

    try {
      calendar.nextAfter(value, new Date(0));
    } catch (error) {
      throw new InvalidIntegrationPartError(
        'schedule cron',
        `is not a valid cron expression (${reasoned(error)})`,
      );
    }

    return new CronExpression(value, calendar);
  }

  nextAfter(from: Date): Date {
    return this.calendar.nextAfter(this.value, from);
  }

  equals(other: CronExpression): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
