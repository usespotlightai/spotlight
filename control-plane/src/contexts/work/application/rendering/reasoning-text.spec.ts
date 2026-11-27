import {
  reasoningCommandsOf,
  reasoningTextOf,
} from '@work/application/rendering/reasoning-text';
import { reasoningIn } from '@work/domain/services/run-reasoning';
import { describe, expect, it } from 'vitest';

const shown = (step: Parameters<typeof reasoningIn>[0]) => {
  const reasoning = reasoningIn(step);

  return reasoning && reasoningTextOf(reasoning);
};

describe('the text of reasoning', () => {
  it('keeps only the command, not the rest of the script it ran in', () => {
    const ran = (text: string) => shown({ kind: 'tool', text });

    expect(
      ran(
        [
          'cd api && spotlight remember --kind environment --body "No make; use npm ci --ignore-scripts | tail" 2>&1 | tail -2',
          "cat > /tmp/note.md <<'E'",
          'Notes',
          'E',
        ].join('\n'),
      ),
    ).toBe(
      'spotlight remember --kind environment --body "No make; use npm ci --ignore-scripts | tail"',
    );
    expect(
      ran("spotlight forget M-2 --because 'Wrong; see #12' && echo done"),
    ).toBe("spotlight forget M-2 --because 'Wrong; see #12'");
    expect(ran('`spotlight handover --note "Retries once"`')).toBe(
      'spotlight handover --note "Retries once"',
    );
  });

  it('names each command of a step that ran several, each alone', () => {
    const reasoning = reasoningIn({
      kind: 'tool',
      text: [
        'spotlight remember --kind environment --body "npm ci fails; use --ignore-scripts." 2>&1',
        'spotlight remember --kind environment --body "Vitest globals are off."',
      ].join('\n'),
    });

    expect(reasoning && reasoningCommandsOf(reasoning)).toEqual([
      'spotlight remember --kind environment --body "npm ci fails; use --ignore-scripts."',
      'spotlight remember --kind environment --body "Vitest globals are off."',
    ]);
    expect(
      reasoningCommandsOf({
        kind: 'message',
        text: 'Done.',
        commandAt: null,
        commandsAt: [],
      }),
    ).toEqual([]);
  });

  it('keeps a message, a thought or a plan whole', () => {
    expect(
      shown({ kind: 'message', text: 'Retried once; it passed.\nDone.' }),
    ).toBe('Retried once; it passed.\nDone.');
  });
});
