export const DELIVERY_WORK = Symbol('DELIVERY_WORK');

export interface DeliveryWorkPort {
  workOff(limit?: number): Promise<number>;
}
