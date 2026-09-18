import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { describe, expect, it } from 'vitest';

const hourly: CronCalendar = {
  nextAfter: (expression, from) => {
    if (expression !== '0 * * * *') {
      throw new Error('unreadable');
    }
    const next = new Date(from);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  },
};

const schedule = () =>
  Schedule.of({ cron: CronExpression.of('0 * * * *', hourly), does: 'digest' });

describe('Schedule', () => {
  it('starts its clock the first time it is seen', () => {
    expect(schedule().turn(null, new Date())).toBe('starts');
  });

  it('is due once its cron has come round, and waits until then', () => {
    const ran = new Date('2026-09-07T09:00:00.000Z');

    expect(schedule().turn(ran, new Date('2026-09-07T09:30:00.000Z'))).toBe(
      'waits',
    );
    expect(schedule().turn(ran, new Date('2026-09-07T10:00:00.000Z'))).toBe(
      'due',
    );
  });

  it('refuses a cron its calendar cannot read', () => {
    expect(() => CronExpression.of('not a cron', hourly)).toThrow(
      /is not a cron expression/,
    );
  });
});
