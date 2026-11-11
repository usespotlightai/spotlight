export const LINES_CONTENT_HASH = Symbol('LINES_CONTENT_HASH');

export interface ContentHashPort {
  sha256(text: string): string;
}
