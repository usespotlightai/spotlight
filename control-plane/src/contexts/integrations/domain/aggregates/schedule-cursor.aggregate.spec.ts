import { ScheduleCursor } from '@integrations/domain/aggregates/schedule-cursor.aggregate';
import { InvalidCursorTransitionError } from '@integrations/domain/exceptions/invalid-cursor-transition.error';
import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const hourly: CronCalendar = {
  nextAfter: (_expression, from) => {
    const next = new Date(from);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  },
};

const schedule = Schedule.of({
  cron: CronExpression.of('0 * * * *', hourly),
  action: 'digest',
});

const stored = (ranAt: Date | null) =>
  ScheduleCursor.rehydrate({
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('linear'),
    ranAt,
    version: 1,
  });

describe('ScheduleCursor', () => {
  it('starts its clock the first time it is claimed', () => {
    const cursor = ScheduleCursor.start(
      TeamId.of('team_1'),
      IntegrationKey.of('linear'),
    );
    const now = new Date('2026-09-07T09:30:00.000Z');

    expect(cursor.turn(schedule, now, hourly)).toBe('starts');
    expect(cursor.claimed(schedule, now, hourly).ranAt).toEqual(now);
  });

  it('cannot be claimed until its cron comes round', () => {
    const cursor = stored(new Date('2026-09-07T09:00:00.000Z'));

    expect(() =>
      cursor.claimed(schedule, new Date('2026-09-07T09:30:00.000Z'), hourly),
    ).toThrow(InvalidCursorTransitionError);
    expect(
      cursor.claimed(schedule, new Date('2026-09-07T10:00:00.000Z'), hourly)
        .ranAt,
    ).toEqual(new Date('2026-09-07T10:00:00.000Z'));
  });

  it('refuses a stored cursor that never ran', () => {
    expect(() => stored(null)).toThrow(InconsistentStateError);
  });
});
