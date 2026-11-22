import { showsReviewing } from '@change-review/domain/services/reviewing-reaction';
import { describe, expect, it } from 'vitest';

describe('showing that a pull request is under review', () => {
  it('shows it only while the current run of its task works', () => {
    expect(showsReviewing({ working: true })).toBe(true);
    expect(showsReviewing({ working: false })).toBe(false);
    expect(showsReviewing(null)).toBe(false);
  });
});
