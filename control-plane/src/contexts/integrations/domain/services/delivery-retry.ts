export const MOST_DELIVERY_ATTEMPTS = 8;

const LONGEST_WAIT_MS = 60 * 60 * 1000;

export const nextDeliveryAttempt = (
  attempts: number,
  now: Date,
): Date | null =>
  attempts >= MOST_DELIVERY_ATTEMPTS
    ? null
    : new Date(now.getTime() + Math.min(2 ** attempts * 1000, LONGEST_WAIT_MS));
