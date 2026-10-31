export type CalendarPage = {
  readonly month: string;
  readonly day: string;
  readonly label: string;
};

export const calendarPage = (day: string): CalendarPage => {
  const at = new Date(`${day}T00:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions): string =>
    at.toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });

  return {
    month: format({ month: 'short' }).toUpperCase(),
    day: String(at.getUTCDate()),
    label: format({ day: 'numeric', month: 'long', year: 'numeric' }),
  };
};
