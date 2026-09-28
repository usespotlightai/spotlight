import { AuthorAssociation } from '@github/application/contracts/author-association.contract';
import { describe, expect, it } from 'vitest';

describe('AuthorAssociation', () => {
  it('says an author who owns, belongs to or collaborates on the repository is not from outside', () => {
    for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR', 'member']) {
      expect(AuthorAssociation.of(association).isOutside).toBe(false);
    }
  });

  it('says an author is from outside unless GitHub says they belong', () => {
    for (const association of [
      'CONTRIBUTOR',
      'FIRST_TIME_CONTRIBUTOR',
      'FIRST_TIMER',
      'NONE',
      ' ',
      null,
    ]) {
      expect(AuthorAssociation.of(association).isOutside).toBe(true);
    }
  });
});
