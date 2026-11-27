import { describe, expect, it } from 'vitest';

import { updateFeedOf } from './update-feed';

describe('updateFeedOf', () => {
  it('reads a pre-release channel from the release named after it', () => {
    expect(updateFeedOf('0.0.0-canary.278.1')).toEqual({
      provider: 'generic',
      url: 'https://github.com/usespotlightai/spotlight/releases/download/canary/',
      channel: 'canary',
    });
  });

  it.each(['1.4.0', '0.12.3'])(
    'keeps the GitHub release feed for version %s',
    (version) => {
      expect(updateFeedOf(version)).toBeNull();
    },
  );
});
