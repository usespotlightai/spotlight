export const HOST_SLOT_LOCKS = Symbol('HOST_SLOT_LOCKS');

export interface HostSlotLocksPort {
  holding<T>(hostId: string, work: () => Promise<T>): Promise<T>;
}
