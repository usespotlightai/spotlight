import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

describe('publicUrlOf', () => {
  it('is SPOTLIGHT_PUBLIC_URL, with no trailing slash', () => {
    expect(
      publicUrlOf(
        partial<Env>({
          SPOTLIGHT_PUBLIC_URL: 'https://app.dev.example.com//',
          BETTER_AUTH_URL: 'http://localhost:3000',
        }),
      ),
    ).toBe('https://app.dev.example.com');
  });

  it('falls back to BETTER_AUTH_URL, with no trailing slash', () => {
    expect(
      publicUrlOf(partial<Env>({ BETTER_AUTH_URL: 'http://localhost:3000/' })),
    ).toBe('http://localhost:3000');
  });
});
