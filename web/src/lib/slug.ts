/**
 * Rewrites free text into the URL-safe shape:
 * ASCII, lowercase, dash-separated. A trailing dash survives so the field stays
 * typeable while someone is spelling out a multi-word slug.
 */
export function sanitizeSlug(value: string): string {
  return (
    value
      .normalize('NFKD')
      // NFKD splits an accented letter into the letter plus a combining mark
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+/, '')
  );
}

/**
 * `sanitizeSlug` without the trailing dash, for slugs derived from a workspace
 * name rather than typed into the URL field.
 */
export function slugify(value: string): string {
  return sanitizeSlug(value).replace(/-+$/, '');
}
