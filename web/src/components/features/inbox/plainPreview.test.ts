import { describe, expect, it } from 'vitest';

import { plainPreview } from '@/components/features/inbox/plainPreview';

describe('plainPreview', () => {
  it('keeps the label of a link', () => {
    expect(
      plainPreview('See [acme/api#431](https://github.com/acme/api/pull/431).'),
    ).toBe('See acme/api#431.');
  });

  it('drops emphasis and code marks', () => {
    expect(
      plainPreview('The **docs lint** step and `npm test` _failed_.'),
    ).toBe('The docs lint step and npm test failed.');
  });

  it('drops heading, quote and list marks', () => {
    expect(plainPreview('# Plan\n> Note\n- one\n* two')).toBe(
      'Plan Note one two',
    );
  });

  it('keeps plain text and snake_case names', () => {
    expect(plainPreview('Which queue for retry_count * 2?')).toBe(
      'Which queue for retry_count * 2?',
    );
  });
});
