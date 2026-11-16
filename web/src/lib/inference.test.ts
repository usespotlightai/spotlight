import { describe, expect, it } from 'vitest';

import { hostOf } from '@/lib/inference';

describe('hostOf', () => {
  it('shows the host of a base URL', () => {
    expect(hostOf('https://openrouter.ai/api/v1')).toBe('openrouter.ai');
    expect(hostOf('http://localhost:11434/v1')).toBe('localhost:11434');
  });

  it('shows a base URL that does not parse as it is', () => {
    expect(hostOf('not a url')).toBe('not a url');
  });
});
