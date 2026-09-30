export const CONTENT_DIGEST = Symbol('CONTENT_DIGEST');

export interface ContentDigestPort {
  sha256(text: string): string;
}
