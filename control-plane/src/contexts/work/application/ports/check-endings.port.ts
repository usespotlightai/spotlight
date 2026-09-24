export const CHECK_ENDINGS = Symbol('CHECK_ENDINGS');

export interface CheckEndingsPort {
  checkEnded(stackId: string): Promise<void>;

  reservationDropped(runnerId: string): Promise<void>;
}
