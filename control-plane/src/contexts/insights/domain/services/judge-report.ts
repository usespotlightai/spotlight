import {
  hasFreeLabel,
  type HumanLabel,
  humanLabelOf,
} from '@insights/domain/services/human-label';
import {
  type Agreement,
  agreementOf,
  type ClaimsPair,
  type Coverage,
  coverageOf,
  type TrendPoint,
  trendOf,
  type VerdictPair,
} from '@insights/domain/services/judge-agreement';
import {
  calibrationOf,
  type JudgeCalibration,
  unreadableRubricCalibration,
} from '@insights/domain/services/judge-calibration';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export interface RubricReport {
  readonly rubricVersion: string;
  readonly judged: number;
  readonly agreement: Agreement;
  readonly trend: readonly TrendPoint[];
  readonly firstAt: Date;
  readonly lastAt: Date;
}

export interface JudgeReport {
  readonly versions: readonly RubricReport[];
  readonly coverage: Coverage;
}

export interface CurrentJudge {
  readonly rubricVersion: string;
  readonly rubric: Rubric | null;
  readonly minAgreement: number;
}

interface Labelling {
  readonly facts: ReadonlyMap<string, RunFact>;
  readonly grades: ReadonlyMap<string, readonly Scored[]>;
}

const humanFor = (
  runId: string,
  rubricVersion: string,
  labelling: Labelling,
): HumanLabel | null =>
  humanLabelOf({
    rubricVersion,
    fact: labelling.facts.get(runId) ?? null,
    grades: labelling.grades.get(runId) ?? [],
  });

const reportOf = (
  rubricVersion: string,
  judged: readonly Scored[],
  labelling: Labelling,
): RubricReport => {
  const humans = judged.map((score) => ({
    score,
    label: humanFor(score.runId.value, rubricVersion, labelling),
  }));
  const verdicts: VerdictPair[] = humans.flatMap(({ score, label }) =>
    label ? [{ judge: score.passes, human: label.passes }] : [],
  );
  const claims: ClaimsPair[] = humans.flatMap(({ score, label }) =>
    label?.claimResults
      ? [{ judge: score.claimResults, human: label.claimResults }]
      : [],
  );
  const times = judged.map((each) => each.at.getTime());

  return {
    rubricVersion,
    judged: judged.length,
    agreement: agreementOf(verdicts, claims),
    trend: trendOf(
      humans.map(({ score, label }) => ({
        at: score.at,
        judge: score.passes,
        human: label?.passes ?? null,
      })),
    ),
    firstAt: new Date(Math.min(...times)),
    lastAt: new Date(Math.max(...times)),
  };
};

const grouped = <T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T[]> => {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
};

export const judgeReportOf = (input: {
  judged: readonly Scored[];
  grades: readonly Scored[];
  facts: readonly RunFact[];
  covering: readonly RunFact[];
}): JudgeReport => {
  const labelling: Labelling = {
    facts: new Map(input.facts.map((each) => [each.runId.value, each])),
    grades: grouped(
      input.grades.filter((each) => !each.fromJudge),
      (each) => each.runId.value,
    ),
  };
  const judgedFromJudge = input.judged.filter((each) => each.fromJudge);
  const versions = [
    ...grouped(judgedFromJudge, (each) => each.rubricVersion ?? ''),
  ]
    .map(([rubricVersion, judged]) =>
      reportOf(rubricVersion, judged, labelling),
    )
    .sort((one, other) => other.lastAt.getTime() - one.lastAt.getTime());
  const judgedRuns = grouped(judgedFromJudge, (each) => each.runId.value);

  return {
    versions,
    coverage: coverageOf(
      input.covering
        .filter((each) => each.ran)
        .map((fact) => {
          const judged = judgedRuns.get(fact.runId.value) ?? [];
          const rubricVersion = judged[0]?.rubricVersion ?? null;

          return {
            judged: judged.length > 0,
            labelled:
              rubricVersion === null
                ? hasFreeLabel(fact) ||
                  (labelling.grades.get(fact.runId.value) ?? []).length > 0
                : humanFor(fact.runId.value, rubricVersion, labelling) !== null,
          };
        }),
    ),
  };
};

export const calibrationIn = (
  report: JudgeReport,
  current: CurrentJudge | null,
): JudgeCalibration => {
  if (!current) {
    return calibrationOf(null);
  }
  if (!current.rubric) {
    return unreadableRubricCalibration(current.minAgreement);
  }

  const version = report.versions.find(
    (each) => each.rubricVersion === current.rubricVersion,
  );

  return calibrationOf({
    minAgreement: current.minAgreement,
    agreement: version?.agreement ?? agreementOf([], []),
  });
};
