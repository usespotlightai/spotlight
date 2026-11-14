export const WARM_SLOTS = Symbol('WARM_SLOTS');

export interface WarmSlotsPort {
  startWarmIfRoomOn<T>(
    hostId: string,
    at: Date,
    start: () => Promise<T | null>,
  ): Promise<T | null>;

  drainWarmOn(
    hostId: string,
    at: Date,
    runWaits: () => Promise<boolean>,
  ): Promise<void>;
}
