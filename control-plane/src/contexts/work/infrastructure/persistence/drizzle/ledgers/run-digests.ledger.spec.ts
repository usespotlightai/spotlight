import { Money } from '@work/domain/value-objects/money.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { JournalBuilder } from '@work/infrastructure/acp/journal-builder';
import {
  digestOf,
  spendAcross,
  spentAcross,
  tokensAcross,
} from '@work/infrastructure/persistence/drizzle/ledgers/run-digests.ledger';
import { describe, expect, it } from 'vitest';

describe('digestOf', () => {
  it('counts a fault for every step that failed, and nothing else', () => {
    const digest = digestOf({
      ms: 4_000,
      statuses: ['completed', 'failed', null, 'running', 'failed'],
      changes: [],
      used: 10,
      size: 200,
      cost: Money.of(0.5, 'USD'),
      tokens: Tokens.UNREPORTED,
    });

    expect(digest.steps).toBe(5);
    expect(digest.faults).toBe(2);
  });

  it('counts the lines its changes removed and added', () => {
    const digest = digestOf({
      ms: null,
      statuses: ['completed', 'completed'],
      changes: [
        { path: 'a.ts', before: 'a\nb\n', after: 'a\nc\n' },
        { path: 'new.ts', before: '', after: 'new\n' },
      ],
      used: null,
      size: null,
      cost: null,
      tokens: Tokens.UNREPORTED,
    });

    expect(digest.changedLines).toBe(3);
  });

  it('says a run did nothing where its journal had nothing', () => {
    const digest = digestOf({
      ms: null,
      statuses: [],
      changes: [],
      used: null,
      size: null,
      cost: null,
      tokens: Tokens.UNREPORTED,
    });

    expect(digest).toEqual({
      ms: null,
      steps: 0,
      faults: 0,
      changedLines: 0,
      used: null,
      size: null,
      cost: null,
      tokens: Tokens.UNREPORTED,
    });
  });
});

describe('spentAcross', () => {
  const reported = (
    session: string,
    used: number,
    amount: number | null,
    currency = 'USD',
  ) => {
    const builder = new JournalBuilder();
    builder.take({
      type: 'output',
      at: new Date('2026-09-29T09:00:00.000Z'),
      message: null,
      data: Buffer.from(
        JSON.stringify({
          sessionId: session,
          update: {
            sessionUpdate: 'usage_update',
            used,
            size: 200_000,
            ...(amount === null ? {} : { cost: { amount, currency } }),
          },
        }),
      ).toString('base64'),
    });
    return builder;
  };

  it('adds up what each conversation cost, taking each at its latest report', () => {
    const spent = spentAcross([
      reported('session_1', 10, 0.5),
      reported('session_1', 20, 1.25),
      reported('session_2', 5, 0.25),
    ]);

    expect(spent?.cost).toEqual(Money.of(1.5, 'USD'));
    expect(spent?.used).toBe(5);
  });

  it('spent nothing where nothing was reported', () => {
    expect(spentAcross([new JournalBuilder()])).toBeNull();
  });

  it('reports each session’s spend in its own currency and counts the unpriced ones, never dropping either', () => {
    expect(
      spendAcross([
        reported('session_1', 10, 0.5),
        reported('session_1', 20, 1.25),
        reported('session_2', 5, null),
        reported('session_3', 5, 0.1, 'EUR'),
      ]),
    ).toEqual({
      costs: [Money.of(1.25, 'USD'), Money.of(0.1, 'EUR')],
      unpricedSessions: 1,
      called: true,
    });
    expect(spendAcross([new JournalBuilder()])).toEqual({
      costs: [],
      unpricedSessions: 0,
      called: false,
    });
  });

  describe('tokensAcross', () => {
    const turned = (...usages: object[]) => {
      const builder = new JournalBuilder();
      for (const usage of usages) {
        builder.take({
          type: 'usage',
          at: new Date('2026-09-29T09:00:00.000Z'),
          message: null,
          data: Buffer.from(JSON.stringify(usage)).toString('base64'),
        });
      }
      return builder;
    };

    it('adds up every turn of every attempt, count by count', () => {
      const tokens = tokensAcross([
        turned(
          {
            inputTokens: 10,
            outputTokens: 20,
            cachedReadTokens: 300,
            cachedWriteTokens: 40,
            totalTokens: 370,
          },
          {
            inputTokens: 1,
            outputTokens: 2,
            cachedReadTokens: 30,
            cachedWriteTokens: 4,
            totalTokens: 37,
          },
        ),
        turned({
          inputTokens: 5,
          outputTokens: 5,
          cachedReadTokens: 0,
          cachedWriteTokens: 0,
          totalTokens: 10,
        }),
      ]);

      expect(tokens).toMatchObject({
        input: 16,
        output: 27,
        cacheRead: 330,
        cacheWrite: 44,
      });
    });

    it('leaves a count no turn reported unknown rather than zero', () => {
      const tokens = tokensAcross([
        turned({
          inputTokens: 10,
          outputTokens: 20,
          cachedReadTokens: 300,
          totalTokens: 330,
        }),
      ]);

      expect(tokens.cacheRead).toBe(300);
      expect(tokens.cacheWrite).toBeNull();
    });

    it('knows nothing of a run whose harness reported no usage', () => {
      expect(
        tokensAcross([new JournalBuilder(), new JournalBuilder()]),
      ).toEqual(Tokens.UNREPORTED);
    });
  });
});
