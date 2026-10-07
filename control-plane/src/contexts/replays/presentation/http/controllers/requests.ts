import { ProblemException } from '@platform/http/resources/problem.exception';
import type {
  SearchAgentAsked,
  SearchBudgetAsked,
  SearchObjectiveAsked,
} from '@replays/application/commands/start-search.command';
import { isSearchObjective } from '@replays/domain/value-objects/search-objective';
import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const REQUEST = 'request';

const refusedAt = (field: readonly string[], reason: string): never => {
  throw ProblemException.invalid(REQUEST, [
    ConfigurationProblem.of({ path: '', at: FieldPath.of(field), reason }),
  ]);
};

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

export const textAt = (body: unknown, field: string, says: string): string => {
  const held = fieldsOf(body)[field];

  return typeof held === 'string' ? held : refusedAt([field], says);
};

const ceilingAt = (
  held: unknown,
  at: readonly string[],
  what: string,
): { readonly amount: number; readonly currency: string } => {
  const { amount, currency } = fieldsOf(held);

  if (typeof amount !== 'number') {
    return refusedAt(
      [...at, 'amount'],
      `must be a number, the most the ${what} may spend`,
    );
  }

  return {
    amount,
    currency:
      typeof currency === 'string'
        ? currency
        : refusedAt([...at, 'currency'], 'must be a currency code, as in USD'),
  };
};

export const ceilingIn = (
  body: unknown,
): { readonly amount: number; readonly currency: string } =>
  ceilingAt(fieldsOf(body).ceiling, ['ceiling'], 'replay');

const countAt = (
  held: Record<string, unknown>,
  at: readonly string[],
  says: string,
): number => {
  const count = held[at[at.length - 1] as string];

  return typeof count === 'number' ? count : refusedAt(at, says);
};

const optionalTextAt = (
  held: Record<string, unknown>,
  at: readonly string[],
  says: string,
): string | null => {
  const text = held[at[at.length - 1] as string];

  if (text === undefined || text === null) {
    return null;
  }

  return typeof text === 'string' ? text : refusedAt(at, says);
};

export const searchBudgetIn = (body: unknown): SearchBudgetAsked => {
  const budget = fieldsOf(fieldsOf(body).budget);
  const concurrency = budget.concurrency;
  const repeats = budget.repeats;

  return {
    iterations: countAt(budget, ['budget', 'iterations'], 'must be a number'),
    perIteration: countAt(
      budget,
      ['budget', 'perIteration'],
      'must be a number',
    ),
    ceiling: ceilingAt(budget.ceiling, ['budget', 'ceiling'], 'search'),
    concurrency:
      concurrency === undefined || concurrency === null
        ? null
        : countAt(budget, ['budget', 'concurrency'], 'must be a number'),
    repeats:
      repeats === undefined || repeats === null
        ? null
        : countAt(budget, ['budget', 'repeats'], 'must be a number'),
  };
};

export const searchAgentIn = (body: unknown): SearchAgentAsked => {
  const agent = fieldsOf(fieldsOf(body).agent);
  const harness = agent.harness;

  return {
    harness:
      typeof harness === 'string'
        ? harness
        : refusedAt(['agent', 'harness'], 'must name the agent’s harness'),
    model: optionalTextAt(
      agent,
      ['agent', 'model'],
      'must be text or left out',
    ),
    effort: optionalTextAt(
      agent,
      ['agent', 'effort'],
      'must be text or left out',
    ),
  };
};

export const objectiveIn = (body: unknown): SearchObjectiveAsked => {
  const held = fieldsOf(body).objective;

  if (held === undefined || held === null) {
    return null;
  }

  return isSearchObjective(held)
    ? held
    : refusedAt(['objective'], 'must be success, cost or left out');
};

export const strongerModelIn = (
  body: unknown,
): { readonly model: string | null; readonly effort: string | null } => {
  const held = fieldsOf(body);

  return {
    model: optionalTextAt(held, ['model'], 'must be text or left out'),
    effort: optionalTextAt(held, ['effort'], 'must be text or left out'),
  };
};

export const repeatsIn = (body: unknown): number => {
  const held = fieldsOf(body);
  const repeats = held.repeats;

  return repeats === undefined || repeats === null
    ? 1
    : countAt(held, ['repeats'], 'must be a number');
};

export const referenceIn = (
  body: unknown,
): {
  readonly commit: string | null;
  readonly pullRequest: number | null;
} => {
  const reference = fieldsOf(fieldsOf(body).reference);
  const pullRequest = reference.pullRequest;

  return {
    commit: optionalTextAt(
      reference,
      ['reference', 'commit'],
      'must be a hex sha or left out',
    ),
    pullRequest:
      pullRequest === undefined || pullRequest === null
        ? null
        : countAt(
            reference,
            ['reference', 'pullRequest'],
            'must be a number or left out',
          ),
  };
};

export const keyedIn = (
  line: string | undefined,
  station: string | undefined,
): { readonly lineId: string; readonly key: string } | null => {
  if (line === undefined && station === undefined) {
    return null;
  }

  return line && station
    ? { lineId: line, key: station }
    : refusedAt(
        [line ? 'station' : 'line'],
        'must be given with both line and station',
      );
};

const isForbidden = <T>(outcome: T | Forbidden): outcome is Forbidden =>
  (outcome as { readonly outcome?: unknown }).outcome === 'forbidden';

export const allowed = <T>(kind: string, outcome: T | Forbidden): T => {
  if (isForbidden(outcome)) {
    throw ProblemException.forbidden(kind, outcome.act);
  }

  return outcome;
};
