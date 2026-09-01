export const DELIVERY_LOG = Symbol('DELIVERY_LOG');

/**
 * A host sends the same word more than once — on retry, and whenever someone
 * asks it to. Acting twice would work the task twice.
 */
export interface DeliveryLogPort {
  /** True the first time, false ever after: it writes as it answers. */
  claim(delivery: string): Promise<boolean>;
}
