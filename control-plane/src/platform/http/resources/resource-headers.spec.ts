import {
  entityTagOf,
  headerIn,
  versionIn,
} from '@platform/http/resources/resource-headers';
import { describe, expect, it } from 'vitest';

describe('resource headers', () => {
  it('carry a version as a strong entity tag, and read it back', () => {
    expect(entityTagOf(3)).toBe('"3"');
    expect(versionIn('"3"')).toBe(3);
    expect(versionIn(' "12" ')).toBe(12);
  });

  it('find no version in a tag this API never issues', () => {
    expect(versionIn('W/"3"')).toBeNull();
    expect(versionIn('*')).toBeNull();
    expect(versionIn('"3", "4"')).toBeNull();
    expect(versionIn('3')).toBeNull();
  });

  it('read a header whatever case it was named in', () => {
    expect(headerIn({ 'if-match': '"3"' }, 'If-Match')).toBe('"3"');
    expect(headerIn({ 'if-match': ['"3"', '"4"'] }, 'If-Match')).toBe('"3"');
    expect(headerIn({}, 'If-Match')).toBeUndefined();
  });
});
