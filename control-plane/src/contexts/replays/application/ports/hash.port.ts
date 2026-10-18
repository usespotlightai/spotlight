export const HASH = Symbol('REPLAYS_HASH');

export interface HashPort {
  sha256(text: string): string;
}
