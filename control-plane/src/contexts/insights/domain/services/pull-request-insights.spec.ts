import {
  weekOf,
  weeksOf,
} from '@insights/domain/services/pull-request-insights';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const WINDOW: Window = {
  from: new Date('2026-09-17T00:00:00.000Z'),
  to: new Date('2026-10-02T00:00:00.000Z'),
};

const day = (date: string, hour = 12) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe('weeks', () => {
  it('starts each week on its Monday, UTC', () => {
    expect(weekOf(day('2026-09-30'))).toBe('2026-09-28');
    expect(weekOf(day('2026-09-28', 0))).toBe('2026-09-28');
    expect(weekOf(day('2026-09-27', 23))).toBe('2026-09-21');
  });

  it('lists every week the period touches, oldest first', () => {
    expect(weeksOf(WINDOW)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
  });
});
