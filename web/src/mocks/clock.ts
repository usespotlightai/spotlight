const HOUR = 3_600_000;

export const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * HOUR).toISOString();

export const daysAgo = (days: number): string => hoursAgo(days * 24);
