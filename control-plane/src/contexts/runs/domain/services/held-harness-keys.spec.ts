import { heldHarnessKeys } from '@runs/domain/services/held-harness-keys';
import { describe, expect, it } from 'vitest';

describe('heldHarnessKeys', () => {
  it('keeps each harness key the workspace holds as a secret, once and sorted', () => {
    expect(
      heldHarnessKeys(
        [
          'OPENROUTER_API_KEY',
          'ANTHROPIC_API_KEY',
          'OPENAI_API_KEY',
          'ANTHROPIC_API_KEY',
        ],
        ['LINEAR_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY'],
      ).map((each) => each.value),
    ).toEqual(['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']);
  });

  it('keeps nothing when the workspace holds none of them', () => {
    expect(heldHarnessKeys(['CURSOR_API_KEY'], ['LINEAR_API_KEY'])).toEqual([]);
  });
});
