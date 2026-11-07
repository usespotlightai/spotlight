import { journalEntryText } from '@runs/application/rendering/journal-entry.text';
import { describe, expect, it } from 'vitest';

const data = (facts: object) =>
  Buffer.from(JSON.stringify(facts), 'utf8').toString('base64');

describe('journalEntryText', () => {
  it.each([
    [
      {
        type: 'hook.called',
        data: data({ hook: 'h', step: 's', target: 't' }),
      },
      'Hook h · s → t',
    ],
    [
      { type: 'provision.failed', data: data({ failure: 'unreachable' }) },
      'Provisioning failed · unreachable',
    ],
    [
      { type: 'run.paused', data: data({ resumesAtOnce: false }) },
      'Waiting for a person',
    ],
    [
      { type: 'run.paused', data: data({ resumesAtOnce: true }) },
      'Messages came in during the turn. The run starts again to read them.',
    ],
  ])('words the control-plane entry %o from its facts', (entry, text) => {
    expect(journalEntryText(entry)).toBe(text);
  });

  it('keeps the message an entry came with', () => {
    expect(journalEntryText({ type: 'output', message: 'hello' })).toBe(
      'hello',
    );
    expect(journalEntryText({ type: 'output', data: data({}) })).toBe(
      undefined,
    );
  });
});
