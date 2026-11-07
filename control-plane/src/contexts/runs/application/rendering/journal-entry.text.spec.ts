import { controlPlaneEntryText } from '@runs/application/rendering/journal-entry.text';
import { describe, expect, it } from 'vitest';

describe('controlPlaneEntryText', () => {
  it.each([
    [
      {
        type: 'hook.called' as const,
        call: {
          attempt: 1,
          hook: 'h',
          step: 's',
          kind: 'call' as const,
          target: 't',
          request: null,
          response: null,
          status: null,
          failed: false,
          startedAt: new Date(0),
          ms: 0,
        },
      },
      'Hook h · s → t',
    ],
    [
      {
        type: 'provision.failed' as const,
        failure: 'unreachable',
        detail: 'no route',
      },
      'Provisioning failed · unreachable',
    ],
    [
      { type: 'run.paused' as const, resumesAtOnce: false },
      'Waiting for a person',
    ],
    [
      { type: 'run.paused' as const, resumesAtOnce: true },
      'Messages came in during the turn. The run starts again to read them.',
    ],
    [
      { type: 'unreadable' as const, entryType: 'hook.called' },
      'Unreadable journal entry · hook.called',
    ],
  ])('words the control-plane entry %o from its facts', (facts, text) => {
    expect(controlPlaneEntryText(facts)).toBe(text);
  });
});
