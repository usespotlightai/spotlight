import { agentSpendOf } from '@work/domain/services/agent-spend';
import { changedLinesOf } from '@work/domain/services/change-hunks';
import {
  type CalledStep,
  toolUseOf,
} from '@work/domain/services/tool-attribution';
import type { Money } from '@work/domain/value-objects/money.vo';
import { faulted } from '@work/domain/value-objects/step-status';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import type { ToolUse } from '@work/domain/value-objects/tool-use.vo';

export interface SpentReading {
  readonly used: number;
  readonly size: number;
  readonly cost: Money | null;
}

export interface StepReading {
  readonly status: string | null;
  readonly change: {
    readonly path: string | null;
    readonly before: string;
    readonly after: string;
  } | null;
}

export interface AttemptReading {
  readonly ms: number | null;
  readonly steps: readonly StepReading[];
  readonly spent: SpentReading | null;
  readonly spentBySession: ReadonlyMap<string, SpentReading>;
  readonly tokens: Tokens;
  readonly calls: readonly CalledStep[];
}

const latestSessions = (
  readings: readonly AttemptReading[],
): readonly SpentReading[] => {
  const bySession = new Map<string, SpentReading>();

  for (const reading of readings) {
    for (const [session, spent] of reading.spentBySession) {
      bySession.set(session, spent);
    }
  }

  return [...bySession.values()];
};

const summed = (costs: readonly Money[]): Money | null =>
  costs.reduce<Money | null>(
    (sum, cost) => (sum ? sum.plus(cost) : cost),
    null,
  );

const costByCurrency = (sessions: readonly SpentReading[]): Money[] => {
  const costs = new Map<string, Money>();

  for (const { cost } of sessions) {
    if (cost) {
      const existing = costs.get(cost.currency);
      costs.set(cost.currency, existing ? existing.plus(cost) : cost);
    }
  }

  return [...costs.values()];
};

export class RunUsage {
  private constructor(
    readonly ms: number | null,
    readonly steps: number,
    readonly errors: number,
    readonly changedLines: number,
    readonly contextTokens: number | null,
    readonly contextWindow: number | null,
    readonly cost: Money | null,
    readonly spentCosts: readonly Money[],
    readonly unpricedCalls: number,
    readonly tokens: Tokens,
    readonly tools: ToolUse,
  ) {}

  static across(
    readings: readonly AttemptReading[],
    skillHomes: readonly string[],
  ): RunUsage {
    const took = readings.flatMap((reading) =>
      reading.ms === null ? [] : [reading.ms],
    );
    const steps = readings.flatMap((reading) => reading.steps);
    const latest =
      readings
        .map((reading) => reading.spent)
        .filter((each) => each !== null)
        .pop() ?? null;
    const sessions = latestSessions(readings);
    const tokens = readings.reduce(
      (all, reading) => all.plus(reading.tokens),
      Tokens.UNREPORTED,
    );
    const spend = agentSpendOf({
      costs: costByCurrency(sessions),
      unpricedSessions: sessions.filter((each) => each.cost === null).length,
      called: sessions.length > 0 || !tokens.equals(Tokens.UNREPORTED),
    });

    return new RunUsage(
      took.length > 0 ? took.reduce((sum, ms) => sum + ms, 0) : null,
      steps.length,
      steps.filter((step) => faulted(step.status)).length,
      changedLinesOf(
        steps.flatMap((step) => (step.change ? [step.change] : [])),
      ),
      latest?.used ?? null,
      latest?.size ?? null,
      latest
        ? summed(
            sessions.flatMap((each) =>
              each.cost && each.cost.currency === latest.cost?.currency
                ? [each.cost]
                : [],
            ),
          )
        : null,
      spend.spentCosts,
      spend.unpricedCalls,
      tokens,
      toolUseOf(
        readings.flatMap((reading) => reading.calls),
        skillHomes,
      ),
    );
  }
}
