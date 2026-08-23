export const CLOCK = Symbol('CLOCK');

/**
 * Time as a dependency: a claim that long-polls and a lease that lapses are
 * both untestable against the real clock.
 */
export interface ClockPort {
  now(): Date;
  sleep(ms: number): Promise<void>;
}
