import { reasoningIn } from '@work/domain/services/run-reasoning';
import { describe, expect, it } from 'vitest';

const kindOf = (step: Parameters<typeof reasoningIn>[0]) =>
  reasoningIn(step)?.kind ?? null;

describe('reasoning in a run’s journal', () => {
  it('is what the agent said, thought and planned', () => {
    expect(kindOf({ kind: 'said', text: 'Retrying once.' })).toBe('said');
    expect(kindOf({ kind: 'thought', text: 'A queue is overkill.' })).toBe(
      'thought',
    );
    expect(kindOf({ kind: 'planned', text: '1. Retry' })).toBe('planned');
  });

  it('is the note it handed its work over with', () => {
    expect(
      kindOf({
        kind: 'tool',
        text: '  spotlight   handover --next review --note "Retries once"',
      }),
    ).toBe('handover');
  });

  it('is what the agent asked its team to remember, however the harness titles the command', () => {
    for (const text of [
      'spotlight remember --kind rationale --body "Retry once"',
      '`spotlight remember --kind rationale --body "Retry once"`',
      'cd api && spotlight remember --kind rationale --body "Retry once"',
    ]) {
      expect(kindOf({ kind: 'tool', text })).toBe('remember');
    }
    expect(
      kindOf({ kind: 'tool', text: 'spotlight recall uploads' }),
    ).toBeNull();
  });

  it('reads the command from what the tool was given when its title does not show it', () => {
    expect(
      reasoningIn({
        kind: 'tool',
        text: 'Terminal',
        given:
          '{"command":"spotlight remember --kind failure --body \\"CI flakes\\""}',
      }),
    ).toEqual({
      kind: 'remember',
      text: '{"command":"spotlight remember --kind failure --body \\"CI flakes\\""}',
    });
  });

  it('is the command the agent ran, not one it only mentions', () => {
    expect(
      kindOf({
        kind: 'tool',
        text: 'spotlight remember --kind rationale --body "Call `spotlight handover` last"',
      }),
    ).toBe('remember');
    expect(
      kindOf({
        kind: 'tool',
        text: 'git commit -m "doc `spotlight remember`"',
      }),
    ).toBeNull();
  });

  it('is never another command, a hook, or nothing said', () => {
    expect(kindOf({ kind: 'tool', text: 'npm test' })).toBeNull();
    expect(kindOf({ kind: 'tool', text: 'spotlight handovers' })).toBeNull();
    expect(
      kindOf({ kind: 'tool', text: 'grep -r "spotlight remember" docs' }),
    ).toBeNull();
    expect(kindOf({ kind: 'hook', text: 'lint passed' })).toBeNull();
    expect(kindOf({ kind: 'said', text: '   ' })).toBeNull();
  });
});
