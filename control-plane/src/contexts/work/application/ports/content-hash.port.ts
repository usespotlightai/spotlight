export const CONTENT_HASH = Symbol('CONTENT_HASH');

export interface ContentHashPort {
  sha256(text: string): string;
}
