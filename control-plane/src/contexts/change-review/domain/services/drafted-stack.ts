import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type {
  DraftedCohort,
  DraftedLayer,
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackProblem } from '@change-review/domain/value-objects/stack-problem.vo';

type Unknown = (raw: string, where: string) => void;

const hunkIn = (raw: string, where: string, unknown: Unknown): HunkId[] => {
  const hunk = HunkId.parsed(raw);

  if (!hunk) {
    unknown(raw, where);
    return [];
  }

  return [hunk];
};

const RENAME = / \(renamed from [^)]*\)$/;

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
    notes: layer.notes.map((each) => ({
      ...each,
      path: each.path.trim().replace(RENAME, ''),
    })),
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
    throw new InvalidChangeStackError(problems.map(StackProblem.shape));
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
};
