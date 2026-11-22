import type { RunDriver } from '@work/domain/value-objects/dispatch-subject';

export const handsOverOnWait = (driver: RunDriver): boolean =>
  driver === 'line';

export const handsOverOnEnd = (
  driver: RunDriver,
  runHandsOver: boolean,
): boolean => handsOverOnWait(driver) && runHandsOver;
