export const WAIT = Symbol('WAIT');

export interface WaitPort {
  for(ms: number): Promise<void>;
}
