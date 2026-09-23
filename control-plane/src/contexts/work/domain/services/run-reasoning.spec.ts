import { reasoningIn } from '@work/domain/services/run-reasoning';
import { describe, expect, it } from 'vitest';

describe('reasoning in a run’s journal', () => {
  it('is what the agent said, thought and planned', () => {
    expect(reasoningIn({ kind: 'said', text: 'Retrying once.' })).toBe('said');
    expect(reasoningIn({ kind: 'thought', text: 'A queue is overkill.' })).toBe(
      'thought',
    );
    expect(reasoningIn({ kind: 'planned', text: '1. Retry' })).toBe('planned');
  });

  it('is the note it handed its work over with', () => {
    expect(
      reasoningIn({
        kind: 'tool',
        text: '  spotlight   handover --next review --note "Retries once"',
      }),
    ).toBe('handover');
  });

  it('is never another command, a hook, or nothing said', () => {
    expect(reasoningIn({ kind: 'tool', text: 'npm test' })).toBeNull();
    expect(
      reasoningIn({ kind: 'tool', text: 'spotlight handovers' }),
    ).toBeNull();
    expect(reasoningIn({ kind: 'hook', text: 'lint passed' })).toBeNull();
    expect(reasoningIn({ kind: 'said', text: '   ' })).toBeNull();
  });
});
