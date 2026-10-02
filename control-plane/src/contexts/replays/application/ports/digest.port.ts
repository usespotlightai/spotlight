export const DIGEST = Symbol('REPLAYS_DIGEST');

export interface DigestPort {
  sha256(text: string): string;
}
