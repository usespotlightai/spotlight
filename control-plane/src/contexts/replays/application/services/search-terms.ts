import type {
  SearchAgentInput,
  SearchBudgetInput,
} from '@replays/application/commands/start-search.command';
import type { WorkPort } from '@replays/application/ports/work.port';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';
import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import {
  type SearchAllotment,
  SearchBudget,
} from '@replays/domain/value-objects/search-budget.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidSearchTermsError extends Error {
  constructor(readonly problems: readonly ConfigurationProblem[]) {
    super('Search is invalid.');
    this.name = 'InvalidSearchTermsError';
  }
}

const problemAt = (
  path: readonly string[],
  reason: string,
): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at: FieldPath.of([...path]), reason });

const problemsOf = (
  made: () => unknown,
  path: readonly string[],
): ConfigurationProblem[] => {
  try {
    made();
    return [];
  } catch (error) {
    if (
      error instanceof InvalidSearchError ||
      error instanceof InvalidSpendError
    ) {
      return [problemAt(path, error.message)];
    }
    throw error;
  }
};

const reject = (problems: readonly ConfigurationProblem[]): void => {
  if (problems.length > 0) {
    throw new InvalidSearchTermsError(problems);
  }
};

const ANY_HARNESS = 'any';

const ANY_CEILING = Spend.ceiling(1, 'USD');

export const searchAgentOf = (
  input: SearchAgentInput,
  work: WorkPort,
): SearchAgent => {
  reject([
    ...problemsOf(
      () =>
        SearchAgent.of({ harness: input.harness, model: null, effort: null }),
      ['agent', 'harness'],
    ),
    ...problemsOf(
      () =>
        SearchAgent.of({
          harness: ANY_HARNESS,
          model: input.model,
          effort: null,
        }),
      ['agent', 'model'],
    ),
    ...problemsOf(
      () =>
        SearchAgent.of({
          harness: ANY_HARNESS,
          model: null,
          effort: input.effort,
        }),
      ['agent', 'effort'],
    ),
  ]);

  const agent = SearchAgent.of(input);
  const problem = work.agentProblem(agent);

  if (problem) {
    reject([problemAt(['agent', problem.field], problem.reason)]);
  }

  return agent;
};

export const searchBudgetOf = (input: SearchBudgetInput): SearchBudget => {
  const counts = (over: Partial<SearchBudgetInput>) => () =>
    SearchBudget.of({
      iterations: over.iterations ?? 1,
      perIteration: over.perIteration ?? 1,
      ceiling: ANY_CEILING,
      ...(over.concurrency === undefined || over.concurrency === null
        ? {}
        : { concurrency: over.concurrency }),
      ...(over.repeats === undefined || over.repeats === null
        ? {}
        : { repeats: over.repeats }),
    });
  const currency = problemsOf(
    () => Spend.none(input.ceiling.currency),
    ['budget', 'ceiling', 'currency'],
  );

  reject([
    ...currency,
    ...(currency.length > 0
      ? []
      : problemsOf(
          () => Spend.ceiling(input.ceiling.amount, input.ceiling.currency),
          ['budget', 'ceiling', 'amount'],
        )),
    ...problemsOf(counts({ iterations: input.iterations }), [
      'budget',
      'iterations',
    ]),
    ...problemsOf(counts({ perIteration: input.perIteration }), [
      'budget',
      'perIteration',
    ]),
    ...problemsOf(counts({ concurrency: input.concurrency }), [
      'budget',
      'concurrency',
    ]),
    ...problemsOf(counts({ repeats: input.repeats }), ['budget', 'repeats']),
  ]);

  return SearchBudget.of({
    iterations: input.iterations,
    perIteration: input.perIteration,
    ceiling: Spend.ceiling(input.ceiling.amount, input.ceiling.currency),
    ...(input.concurrency === null ? {} : { concurrency: input.concurrency }),
    ...(input.repeats === null ? {} : { repeats: input.repeats }),
  });
};

export const splitOf = (drawn: () => HeldOutSplit): HeldOutSplit => {
  try {
    return drawn();
  } catch (error) {
    if (error instanceof SearchSetTooSmallError) {
      throw new InvalidSearchTermsError([problemAt(['setId'], error.message)]);
    }
    throw error;
  }
};

export const allotmentOf = (
  budget: SearchBudget,
  split: HeldOutSplit,
): SearchAllotment => {
  try {
    return budget.allot(split);
  } catch (error) {
    if (error instanceof InvalidSearchError) {
      throw new InvalidSearchTermsError([
        problemAt(['budget', 'ceiling', 'amount'], error.message),
      ]);
    }
    throw error;
  }
};
