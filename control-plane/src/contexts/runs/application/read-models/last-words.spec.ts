import type {
  JournalStep,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import { lastWordsIn } from '@runs/application/read-models/last-words';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

const at = (time: string) => new Date(`2026-10-20T${time}:00.000Z`);

const attempt = (
  number: number,
  steps: readonly [kind: JournalStep['kind'], text: string, time: string][],
): RunJournal =>
  partial<RunJournal>({
    attempt: number,
    steps: steps.map(([kind, text, time]) =>
      partial<JournalStep>({
        kind,
        text,
        startedAt: at(time),
      }),
    ),
  });

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
