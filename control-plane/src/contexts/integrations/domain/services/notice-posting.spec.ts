import { postsAgainWithoutUploads } from '@integrations/domain/services/notice-posting';
import { describe, expect, it } from 'vitest';

describe('postsAgainWithoutUploads', () => {
  it('posts again without the files when the service refused a post that carried files', () => {
    expect(
      postsAgainWithoutUploads({ kind: 'failed', answered: true }, 2),
    ).toBe(true);
  });

  it('does not post again when the post carried no files', () => {
    expect(
      postsAgainWithoutUploads({ kind: 'failed', answered: true }, 0),
    ).toBe(false);
  });

  it('does not post again when the service did not answer', () => {
    expect(
      postsAgainWithoutUploads({ kind: 'failed', answered: false }, 2),
    ).toBe(false);
  });

  it('does not post again a post that was sent', () => {
    expect(postsAgainWithoutUploads({ kind: 'sent' }, 2)).toBe(false);
  });
});
