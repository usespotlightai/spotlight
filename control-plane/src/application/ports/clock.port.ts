export const CLOCK = Symbol('CLOCK');

export interface ClockPort {
  now(): Date;
  sleep(ms: number): Promise<void>;
}
