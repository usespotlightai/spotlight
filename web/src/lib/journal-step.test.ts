import { describe, expect, it } from 'vitest';
import type { JournalStep } from '@/lib/inbox';
import { shownStep } from '@/lib/journal-step';

const step = (over: Partial<JournalStep>): JournalStep => ({
  kind: 'message',
  text: '',
  status: null,
  tool: null,
  detail: null,
  ms: 0,
  startedAt: '2026-11-09T12:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
  ...over,
});

describe('shownStep', () => {
  it('shows a subagent with what it was asked, what it did and its answer', () => {
    const shown = shownStep(
      step({
        kind: 'subagent',
        text: 'Explore',
        input: 'Find where uploads retry.',
        detail: '- grep retry',
        output: 'Retries live in uploads.ts.',
      }),
    );

    expect(shown.label).toBe('Delegated Explore');
    expect(shown.prose).toBe(true);
    expect(shown.body).toBe(
      'Asked: Find where uploads retry.\n\n- grep retry\n\nAnswered: Retries live in uploads.ts.',
    );
  });

  it('shows a wait for background work and what still ran at the limit', () => {
    const shown = shownStep(
      step({
        kind: 'waited',
        text: 'npx vitest run',
        detail: 'Still running at the wait limit: npx vitest run',
      }),
    );

    expect(shown.label).toBe('Waited for npx vitest run');
    expect(shown.body).toBe('Still running at the wait limit: npx vitest run');
  });

  it('shows background work that stopped with the run', () => {
    expect(
      shownStep(step({ kind: 'lost', text: 'npx vitest run with the sandbox' }))
        .label,
    ).toBe('Stopped npx vitest run with the sandbox');
  });

  it('shows the reminder to hand over with its words', () => {
    const shown = shownStep(
      step({
        kind: 'reminded',
        text: 'the agent to hand over',
        detail: 'Your turn ended without a handover.',
      }),
    );

    expect(shown.label).toBe('Reminded the agent to hand over');
    expect(shown.body).toBe('Your turn ended without a handover.');
  });
});
