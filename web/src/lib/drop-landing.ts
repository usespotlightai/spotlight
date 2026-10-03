import type { Landing } from '@/lib/dragging';

export const landsOnEmptyStation = (
  landing: Landing | null,
  stationId: string,
  count: number,
): boolean =>
  landing?.stationId === stationId &&
  landing.afterTaskId === null &&
  count === 0;

export const rowLanding = (
  landing: Landing | null,
  stationId: string,
  taskId: string,
  spot: number,
): 'above' | 'below' | undefined => {
  if (landing?.stationId !== stationId) {
    return undefined;
  }

  if (landing.afterTaskId === taskId) {
    return 'below';
  }

  return landing.afterTaskId === null && spot === 0 ? 'above' : undefined;
};
