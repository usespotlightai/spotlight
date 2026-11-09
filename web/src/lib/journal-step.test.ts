import { describe, expect, it } from 'vitest';
import type { JournalStep } from '@/lib/inbox';
import { shownStep, stretchesOf } from '@/lib/journal-step';

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

describe('stretchesOf', () => {
  const said = (text: string) => step({ kind: 'message', text });
  const ran = (detail: string) =>
    step({ kind: 'tool', tool: 'execute', detail });

  it('gives nothing for no steps', () => {
    expect(stretchesOf([])).toEqual([]);
  });

  it('keeps each message on its own, also two in a row', () => {
    const first = said('Looking.');
    const second = said('Found it.');

    expect(stretchesOf([first, second])).toEqual([
      { kind: 'said', at: 0, step: first },
      { kind: 'said', at: 1, step: second },
    ]);
  });

  it('folds the steps between messages into one stretch each', () => {
    const one = ran('ls');
    const two = ran('cat a.ts');
    const message = said('Next, the tests.');
    const three = ran('npm test');

    expect(stretchesOf([one, two, message, three])).toEqual([
      { kind: 'worked', at: 0, steps: [one, two] },
      { kind: 'said', at: 2, step: message },
      { kind: 'worked', at: 3, steps: [three] },
    ]);
  });
});
