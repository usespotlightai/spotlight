export const WARM_SLOTS = Symbol('WARM_SLOTS');

export interface WarmSlotsPort {
  roomForWarmOn(hostId: string, at: Date): Promise<boolean>;

  drainWarmOn(hostId: string, at: Date): Promise<void>;
}
