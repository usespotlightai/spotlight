import { humanLabelOf } from '@insights/domain/services/human-label';
import {
  type Agreement,
  agreementOf,
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

const reportOf = (
  rubricVersion: string,
  judged: readonly Scored[],
  facts: ReadonlyMap<string, RunFact>,
): RubricReport => {
  const humans = judged.map((score) => ({
    score,
    label: humanLabelOf(facts.get(score.runId.value) ?? null),
  }));
  const verdicts: VerdictPair[] = humans.flatMap(({ score, label }) =>
    label ? [{ judge: score.passes, human: label.passes }] : [],
  );
  const times = judged.map((each) => each.at.getTime());

  return {
    rubricVersion,
    judged: judged.length,
    agreement: agreementOf(verdicts),
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
  facts: readonly RunFact[];
  covering: readonly RunFact[];
}): JudgeReport => {
  const facts = new Map(input.facts.map((each) => [each.runId.value, each]));
  const versions = [...grouped(input.judged, (each) => each.rubricVersion)]
    .map(([rubricVersion, judged]) => reportOf(rubricVersion, judged, facts))
    .sort((one, other) => other.lastAt.getTime() - one.lastAt.getTime());
  const judgedRuns = new Set(input.judged.map((each) => each.runId.value));

  return {
    versions,
    coverage: coverageOf(
      input.covering
        .filter((each) => each.ran)
        .map((fact) => ({
          judged: judgedRuns.has(fact.runId.value),
          labelled: humanLabelOf(fact) !== null,
        })),
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
    agreement: version?.agreement ?? agreementOf([]),
  });
};
