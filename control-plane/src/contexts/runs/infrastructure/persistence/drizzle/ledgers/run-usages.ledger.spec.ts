import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import { Money } from '@runs/domain/value-objects/money.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import { readingOf } from '@runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { describe, expect, it } from 'vitest';

const encoded = (payload: object) =>
  Buffer.from(JSON.stringify(payload)).toString('base64');

describe('readingOf', () => {
  it('reads what each conversation of an attempt last reported it spent, and the tokens of its turns', () => {
    const journal = new JournalBuilder();
    journal.take({
      type: HARNESS_CONNECTED,
      at: new Date('2026-09-29T09:00:00.000Z'),
      message: null,
      data: encoded({
        protocol: 'acp/1',
        events: 1,
        session: 'session_1',
        reports: {
          background: false,
          selfStartedTurns: false,
          turnUsage: true,
          commandOutput: false,
        },
      }),
    });
    for (const [session, used, amount] of [
      ['session_1', 10, 0.5],
      ['session_1', 20, 1.25],
      ['session_2', 5, 0.25],
    ] as const) {
      journal.take({
        type: 'context.changed',
        at: new Date('2026-09-29T09:00:00.000Z'),
        message: null,
        data: encoded({
          session,
          used,
          size: 200_000,
          cost: { amount, currency: 'USD' },
        }),
      });
    }
    journal.take({
      type: 'turn.ended',
      at: new Date('2026-09-29T09:00:01.000Z'),
      message: null,
      data: encoded({
        turn: 1,
        stop: 'ended',
        usage: { input: 10, output: 20, cacheRead: 300 },
      }),
    });

    const reading = readingOf(journal, true);

    expect(reading.spent).toEqual({
      used: 5,
      size: 200_000,
      cost: Money.of(0.25, 'USD'),
    });
    expect(reading.spentBySession.get('session_1')?.cost).toEqual(
      Money.of(1.25, 'USD'),
    );
    expect(reading.tokens).toEqual(
      Tokens.of({ input: 10, output: 20, cacheRead: 300 }),
    );
  });

  it('reads nothing from an attempt with no journal', () => {
    expect(readingOf(new JournalBuilder(), true)).toMatchObject({
      ms: null,
      steps: [],
      spent: null,
      tokens: Tokens.UNREPORTED,
      calls: [],
    });
  });
});
