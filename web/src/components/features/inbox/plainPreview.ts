export const plainPreview = (markdown: string): string =>
  markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, (_, label: string) => label)
    .replace(/(\*\*|__|~~)(.+?)\1/g, (_, _mark: string, text: string) => text)
    .replace(
      /(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/g,
      (_, before: string, text: string) => before + text,
    )
    .replace(/`+([^`]*)`+/g, (_, code: string) => code)
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+)/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
