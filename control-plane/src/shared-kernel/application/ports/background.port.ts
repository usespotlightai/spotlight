export const BACKGROUND = Symbol('BACKGROUND');

export interface BackgroundPort {
  start(work: () => Promise<void>): void;
}
