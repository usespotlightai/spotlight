import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { describe, expect, it } from 'vitest';

describe('the base URL of an inference endpoint', () => {
  it.each([
    ['https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1'],
    ['  http://litellm:4000/v1/  ', 'http://litellm:4000/v1'],
  ])('accepts %s', (written, kept) => {
    expect(BaseUrl.of(written).value).toBe(kept);
  });

  it.each([
    'not a url',
    'ftp://example.com/v1',
    'https://user:pass@example.com/v1',
    'https://example.com/v1?key=1',
    'https://example.com/v1#top',
  ])('refuses %s', (written) => {
    expect(() => BaseUrl.of(written)).toThrow('baseUrl');
  });
});
