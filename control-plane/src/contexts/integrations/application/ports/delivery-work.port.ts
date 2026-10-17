export const DELIVERY_WORK = Symbol('DELIVERY_WORK');

export interface DeliveryWorkPort {
  processDue(limit?: number): Promise<number>;
}
