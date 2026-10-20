import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import { lastWordsIn } from '@work/application/services/last-words';
import { describe, expect, it } from 'vitest';

const at = (time: string) => new Date(`2026-10-20T${time}:00.000Z`);

const attempt = (
  number: number,
  steps: readonly [kind: string, text: string, time: string][],
): RunJournal =>
  ({
    attempt: number,
    steps: steps.map(([kind, text, time]) => ({
      kind,
      text,
      startedAt: at(time),
    })),
  }) as unknown as RunJournal;

describe('lastWordsIn', () => {
  it('takes the last message of the latest attempt', () => {
    expect(
      lastWordsIn(
        [
          attempt(2, [
            ['message', 'Looking at it.', '10:00'],
            ['message', 'Here is a draft.', '10:01'],
            ['tool', 'archive', '10:02'],
          ]),
          attempt(1, [['message', 'Which queue?', '09:00']]),
        ],
        null,
      ),
    ).toBe('Here is a draft.');
  });

  it('leaves out what the agent said before the person last answered', () => {
    expect(
      lastWordsIn(
        [
          attempt(1, [
            ['message', 'Which queue?', '09:00'],
            ['tool', 'drain', '09:10'],
          ]),
        ],
        at('09:05'),
      ),
    ).toBeNull();
  });

  it('finds no words in a run without attempts', () => {
    expect(lastWordsIn([], null)).toBeNull();
  });
});
