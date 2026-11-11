import type { CalledStep } from '@runs/domain/services/tool-attribution';
import { Money } from '@runs/domain/value-objects/money.vo';
import {
  type AttemptReading,
  RunUsage,
  type SpentReading,
} from '@runs/domain/value-objects/run-usage.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

const attempt = (over: Partial<AttemptReading> = {}): AttemptReading => ({
  handedOver: true,
  ms: null,
  steps: [],
  spent: null,
  spentBySession: new Map(),
  tokens: Tokens.UNREPORTED,
  calls: [],
  ...over,
});

const spent = (
  used: number,
  amount: number | null,
  currency = 'USD',
): SpentReading => ({
  used,
  size: 200_000,
  cost: amount === null ? null : Money.of(amount, currency),
});

const sessions = (
  ...entries: (readonly [string, SpentReading])[]
): Partial<AttemptReading> => ({
  spent: entries[entries.length - 1]?.[1] ?? null,
  spentBySession: new Map(entries),
});

const called = (over: Partial<CalledStep> = {}): CalledStep => ({
  server: 'linear',
  tool: 'comment',
  requestedSkill: null,
  paths: [],
  ms: 300,
  ending: 'completed',
  ...over,
});

describe('RunUsage.across', () => {
  it('counts an error for every step that failed, and nothing else', () => {
    const usage = RunUsage.across(
      [
        attempt({
          steps: ['completed', 'failed', null, 'running', 'failed'].map(
            (status) => ({ status, change: null }),
          ),
        }),
      ],
      [],
    );

    expect(usage.steps).toBe(5);
    expect(usage.errors).toBe(2);
  });

  it('counts the lines its changes removed and added', () => {
    const usage = RunUsage.across(
      [
        attempt({
          steps: [
            {
              status: 'completed',
              change: { path: 'a.ts', before: 'a\nb\n', after: 'a\nc\n' },
            },
            {
              status: 'completed',
              change: { path: 'new.ts', before: '', after: 'new\n' },
            },
          ],
        }),
      ],
      [],
    );

    expect(usage.changedLines).toBe(3);
  });

  it('says a run did nothing where its journal had nothing', () => {
    const usage = RunUsage.across([attempt(), attempt()], []);

    expect(usage).toMatchObject({
      ms: null,
      steps: 0,
      errors: 0,
      changedLines: 0,
      contextTokens: null,
      contextWindow: null,
      cost: null,
      spentCosts: [],
      unpricedCalls: 0,
      tokens: Tokens.UNREPORTED,
    });
    expect(usage.tools.servers).toEqual([]);
  });

  it('adds up the time the agent worked in every attempt', () => {
    expect(
      RunUsage.across(
        [attempt({ ms: 1_000 }), attempt(), attempt({ ms: 500 })],
        [],
      ).ms,
    ).toBe(1_500);
  });

  it('adds up what each conversation cost, taking each at its latest report, in the currency reported last', () => {
    const usage = RunUsage.across(
      [
        attempt(
          sessions(
            ['session_1', spent(10, 0.5)],
            ['session_3', spent(1, 9, 'EUR')],
          ),
        ),
        attempt(
          sessions(
            ['session_1', spent(20, 1.25)],
            ['session_2', spent(5, 0.25)],
          ),
        ),
      ],
      [],
    );

    expect(usage.cost).toEqual(Money.of(1.5, 'USD'));
    expect(usage.contextTokens).toBe(5);
    expect(usage.contextWindow).toBe(200_000);
  });

  it('reports each session’s spend in its own currency and counts the unpriced ones, never dropping either', () => {
    const usage = RunUsage.across(
      [
        attempt(
          sessions(
            ['session_1', spent(10, 0.5)],
            ['session_2', spent(5, null)],
            ['session_3', spent(5, 0.1, 'EUR')],
          ),
        ),
        attempt(sessions(['session_1', spent(20, 1.25)])),
      ],
      [],
    );

    expect(usage.spentCosts).toEqual([
      Money.of(1.25, 'USD'),
      Money.of(0.1, 'EUR'),
    ]);
    expect(usage.unpricedCalls).toBe(1);
  });

  it('counts one unpriced call for a run that used tokens but reported no spend', () => {
    const usage = RunUsage.across(
      [attempt({ tokens: Tokens.of({ input: 10 }) })],
      [],
    );

    expect(usage.spentCosts).toEqual([]);
    expect(usage.unpricedCalls).toBe(1);
  });

  it('adds up the tokens of every attempt, count by count, leaving a count none reported unknown', () => {
    const usage = RunUsage.across(
      [
        attempt({
          tokens: Tokens.of({ input: 11, output: 22, cacheRead: 330 }),
        }),
        attempt({ tokens: Tokens.of({ input: 5, output: 5, cacheRead: 0 }) }),
      ],
      [],
    );

    expect(usage.tokens).toEqual(
      Tokens.of({ input: 16, output: 27, cacheRead: 330 }),
    );
    expect(usage.tokens.cacheWrite).toBeNull();
  });

  it('counts the calls to each server and the team skills read, across attempts', () => {
    const usage = RunUsage.across(
      [
        attempt({ calls: [called()] }),
        attempt({
          calls: [
            called({ ending: 'failed', ms: 900 }),
            called({
              server: null,
              tool: 'read',
              paths: ['.claude/skills/our-migrations/SKILL.md'],
            }),
          ],
        }),
      ],
      ['.claude/skills'],
    );

    expect(usage.tools.servers).toEqual([
      expect.objectContaining({
        server: 'linear',
        calls: 2,
        failed: 1,
        lastCallFailed: true,
      }),
    ]);
    expect(usage.tools.skills).toEqual(['our-migrations']);
  });

  it('measures the attempts that handed over, and counts the spend of every attempt', () => {
    const usage = RunUsage.across(
      [
        attempt({
          handedOver: false,
          ms: 5_000,
          steps: [{ status: 'completed', change: null }],
          spentBySession: new Map([['lost', spent(1_000, 0.5)]]),
        }),
        attempt({
          ms: 2_000,
          steps: [{ status: 'completed', change: null }],
          spentBySession: new Map([['final', spent(2_000, 0.25)]]),
        }),
      ],
      [],
    );

    expect([usage.ms, usage.steps]).toEqual([2_000, 1]);
    expect(usage.spentCosts.map((each) => each.amount)).toEqual([0.75]);
  });
});
