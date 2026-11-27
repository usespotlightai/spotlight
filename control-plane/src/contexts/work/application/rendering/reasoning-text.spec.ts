import { reasoningTextOf } from '@work/application/rendering/reasoning-text';
import { reasoningIn } from '@work/domain/services/run-reasoning';
import { describe, expect, it } from 'vitest';

const shown = (step: Parameters<typeof reasoningIn>[0]) => {
  const reasoning = reasoningIn(step);

  return reasoning && reasoningTextOf(reasoning);
};

describe('the text of reasoning', () => {
  it('keeps only the command, not the rest of the script it ran in', () => {
    expect(
      shown({
        kind: 'tool',
        text: 'cd api && spotlight remember --kind environment --body "No make; use npm ci" 2>&1 | tail -2',
      }),
    ).toBe(
      'spotlight remember --kind environment --body "No make; use npm ci"',
    );
  });

  it('shows the first command of a step that ran several', () => {
    expect(
      shown({
        kind: 'tool',
        text: [
          'spotlight remember --kind environment --body "npm ci fails."',
          'spotlight remember --kind environment --body "Vitest globals are off."',
        ].join('\n'),
      }),
    ).toBe('spotlight remember --kind environment --body "npm ci fails."');
  });

  it('keeps a message, a thought or a plan whole', () => {
    expect(
      shown({ kind: 'message', text: 'Retried once; it passed.\nDone.' }),
    ).toBe('Retried once; it passed.\nDone.');
  });
});
