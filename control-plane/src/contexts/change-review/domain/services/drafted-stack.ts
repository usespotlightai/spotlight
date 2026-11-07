import {
  InvalidChangeStackError,
  shapeProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type {
  DraftedCohort,
  DraftedLayer,
  DraftedOutline,
  OutlinedCohort,
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';

type Unknown = (raw: string, where: string) => void;

const hunkIn = (raw: string, where: string, unknown: Unknown): HunkId[] => {
  const hunk = HunkId.parsed(raw);

  if (!hunk) {
    unknown(raw, where);
    return [];
  }

  return [hunk];
};

const layersIn = (
  layers: readonly DraftedLayer[],
  where: string,
  unknown: Unknown,
): ProposedLayer[] =>
  layers.map((layer, l) => ({
    ...layer,
    hunks: layer.hunks.flatMap((entry) =>
      hunkIn(entry.hunk, `${where}layer ${l + 1}`, unknown).map((hunk) => ({
        hunk,
      })),
    ),
    questions: layer.questions.map((each) => ({
      ...each,
      hunks: each.hunks.flatMap((hunk) => HunkId.parsed(hunk) ?? []),
    })),
  }));

const read = <T>(reading: (unknown: Unknown) => T): T => {
  const problems: string[] = [];
  const result = reading((raw, where) => {
    problems.push(
      `${where} names ${raw || 'nothing'}, which is not in the diff`,
    );
  });

  if (problems.length > 0) {
    throw new InvalidChangeStackError(problems.map(shapeProblem));
  }

  return result;
};

export const DraftedStack = {
  cohorts(drafted: readonly DraftedCohort[]): ProposedCohort[] {
    return read((unknown) =>
      drafted.map((cohort, c) => ({
        ...cohort,
        layers: layersIn(cohort.layers, `cohort ${c + 1}, `, unknown),
      })),
    );
  },

  layers(drafted: readonly DraftedLayer[]): ProposedLayer[] {
    return read((unknown) => layersIn(drafted, '', unknown));
  },

  outline(drafted: readonly DraftedOutline[]): OutlinedCohort[] {
    return read((unknown) =>
      drafted.map((cohort, c) => ({
        ...cohort,
        hunks: cohort.hunks.flatMap((hunk) =>
          hunkIn(hunk, `cohort ${c + 1}`, unknown),
        ),
      })),
    );
  },
};
