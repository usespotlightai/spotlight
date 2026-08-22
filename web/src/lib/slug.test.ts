import { describe, expect, it } from 'vitest';
import { sanitizeSlug, slugify } from '@/lib/slug';

describe('sanitizeSlug', () => {
  it('lowercases and joins words with a dash', () => {
    expect(sanitizeSlug('Acme Inc')).toBe('acme-inc');
  });

  it('folds accents down to ASCII', () => {
    expect(sanitizeSlug('Café Zürich')).toBe('cafe-zurich');
  });

  it('collapses runs of separators and drops leading ones', () => {
    expect(sanitizeSlug('  Acme -- Inc  ')).toBe('acme-inc-');
  });

  it('keeps a trailing dash so the field stays typeable', () => {
    expect(sanitizeSlug('acme-')).toBe('acme-');
  });
});

describe('slugify', () => {
  it('drops the trailing dash a name leaves behind', () => {
    expect(slugify('Acme Inc. ')).toBe('acme-inc');
  });

  it('is empty when there is nothing URL-safe to keep', () => {
    expect(slugify('!!!')).toBe('');
  });
});
