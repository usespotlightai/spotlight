import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { unsearchableChanges } from '@replays/domain/services/searchable-changes';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export type ProposedBlock =
  | { readonly ok: true; readonly block: StationBlock }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export type SearchedProposal =
  | {
      readonly ok: true;
      readonly name: CandidateName;
      readonly hypothesis: Hypothesis;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: ConfigurationProblem };

export const nameProblem = (reason: string): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at: FieldPath.of(['name']), reason });

const parsed = <T>(field: string, made: () => T): Parsed<T> => {
  try {
    return { ok: true, value: made() };
  } catch (error) {
    if (error instanceof InvalidCandidateError) {
      return {
        ok: false,
        problem: ConfigurationProblem.of({
          path: '',
          at: FieldPath.of([field]),
          reason: error.reason,
        }),
      };
    }
    throw error;
  }
};

export const searchedProposalOf = (input: {
  readonly name: string;
  readonly hypothesis: string;
  readonly seed: StationBlock;
  readonly proposed: ProposedBlock;
}): SearchedProposal => {
  const name = parsed('name', () => CandidateName.searched(input.name));
  const hypothesis = parsed('hypothesis', () =>
    Hypothesis.of(input.hypothesis),
  );
  const problems = [
    ...(name.ok ? [] : [name.problem]),
    ...(hypothesis.ok ? [] : [hypothesis.problem]),
    ...(input.proposed.ok
      ? unsearchableChanges(input.seed, input.proposed.block)
      : input.proposed.problems),
  ];

  return name.ok && hypothesis.ok && problems.length === 0
    ? { ok: true, name: name.value, hypothesis: hypothesis.value }
    : { ok: false, problems };
};
