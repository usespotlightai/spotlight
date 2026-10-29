const ZERO_WIDTH_SPACE = '​';

export const markdownText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\<>[\]!|`]/g, (character) => `\\${character}`)
    .replace(/@/g, `@${ZERO_WIDTH_SPACE}`);

export const clippedText = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
