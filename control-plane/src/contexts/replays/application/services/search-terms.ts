import type {
  SearchAgentAsked,
  SearchBudgetAsked,
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

export class SearchTermsRefusedError extends Error {
  constructor(readonly problems: readonly ConfigurationProblem[]) {
    super('The search is not valid');
    this.name = 'SearchTermsRefusedError';
  }
}

const problemAt = (
  path: readonly string[],
  reason: string,
): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at: FieldPath.of([...path]), reason });

const refusalOf = (
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

const refused = (problems: readonly ConfigurationProblem[]): void => {
  if (problems.length > 0) {
    throw new SearchTermsRefusedError(problems);
  }
};

const ANY_HARNESS = 'any';

const ANY_CEILING = Spend.ceiling(1, 'USD');

export const searchAgentOf = (
  asked: SearchAgentAsked,
  work: WorkPort,
): SearchAgent => {
  refused([
    ...refusalOf(
      () =>
        SearchAgent.of({ harness: asked.harness, model: null, effort: null }),
      ['agent', 'harness'],
    ),
    ...refusalOf(
      () =>
        SearchAgent.of({
          harness: ANY_HARNESS,
          model: asked.model,
          effort: null,
        }),
      ['agent', 'model'],
    ),
    ...refusalOf(
      () =>
        SearchAgent.of({
          harness: ANY_HARNESS,
          model: null,
          effort: asked.effort,
        }),
      ['agent', 'effort'],
    ),
  ]);

  const agent = SearchAgent.of(asked);
  const refusal = work.agentRefusal(agent);

  if (refusal) {
    refused([problemAt(['agent', refusal.field], refusal.reason)]);
  }

  return agent;
};

export const searchBudgetOf = (asked: SearchBudgetAsked): SearchBudget => {
  const counts = (over: Partial<SearchBudgetAsked>) => () =>
    SearchBudget.of({
      iterations: over.iterations ?? 1,
      perIteration: over.perIteration ?? 1,
      ceiling: ANY_CEILING,
      ...(over.concurrency === undefined || over.concurrency === null
        ? {}
        : { concurrency: over.concurrency }),
    });
  const currency = refusalOf(
    () => Spend.none(asked.ceiling.currency),
    ['budget', 'ceiling', 'currency'],
  );

  refused([
    ...currency,
    ...(currency.length > 0
      ? []
      : refusalOf(
          () => Spend.ceiling(asked.ceiling.amount, asked.ceiling.currency),
          ['budget', 'ceiling', 'amount'],
        )),
    ...refusalOf(counts({ iterations: asked.iterations }), [
      'budget',
      'iterations',
    ]),
    ...refusalOf(counts({ perIteration: asked.perIteration }), [
      'budget',
      'perIteration',
    ]),
    ...refusalOf(counts({ concurrency: asked.concurrency }), [
      'budget',
      'concurrency',
    ]),
  ]);

  return SearchBudget.of({
    iterations: asked.iterations,
    perIteration: asked.perIteration,
    ceiling: Spend.ceiling(asked.ceiling.amount, asked.ceiling.currency),
    ...(asked.concurrency === null ? {} : { concurrency: asked.concurrency }),
  });
};

export const splitOf = (drawn: () => HeldOutSplit): HeldOutSplit => {
  try {
    return drawn();
  } catch (error) {
    if (error instanceof SearchSetTooSmallError) {
      throw new SearchTermsRefusedError([problemAt(['setId'], error.message)]);
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
      throw new SearchTermsRefusedError([
        problemAt(['budget', 'ceiling', 'amount'], error.message),
      ]);
    }
    throw error;
  }
};
