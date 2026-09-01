export const DELIVERY_WORK = Symbol('DELIVERY_WORK');

/**
 * Working off what the inbox has taken in. Driven from outside, so what turns
 * the handle and what does the work are told apart.
 */
export interface DeliveryWorkPort {
  /** How many were worked, so a caller knows whether to come straight back. */
  workOff(limit?: number): Promise<number>;
}
