import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const poll = () =>
  Poll.of({
    every: 60,
    declares: [
      DeclaredHappening.of({
        happening: HappeningName.of('linear.issue.completed'),
        label: 'Done',
        summary: 'Done.',
        finds: [MarkKind.of('linear.issue')],
      }),
    ],
  });

describe('Poll', () => {
  it('is due when it has never run', () => {
    expect(poll().isDue(null, NOW)).toBe(true);
  });

  it('waits out its interval after a run', () => {
    expect(poll().isDue(new Date(NOW.getTime() - 30_000), NOW)).toBe(false);
    expect(poll().isDue(new Date(NOW.getTime() - 60_000), NOW)).toBe(true);
  });

  it('rejects one that raises nothing', () => {
    expect(() => Poll.of({ every: 60, declares: [] })).toThrow(
      /raises no events/,
    );
  });
});
