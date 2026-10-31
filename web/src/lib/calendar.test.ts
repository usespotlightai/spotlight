import { describe, expect, it } from 'vitest';
import { calendarPage } from '@/lib/calendar';

describe('calendarPage', () => {
  it('names the month and the day of a calendar page', () => {
    expect(calendarPage('2026-10-28')).toEqual({
      month: 'OCT',
      day: '28',
      label: 'October 28, 2026',
    });
  });

  it('keeps the day it was given, whatever the time zone', () => {
    expect(calendarPage('2026-11-01').day).toBe('1');
  });
});
