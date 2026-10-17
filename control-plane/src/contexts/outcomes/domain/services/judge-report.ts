import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type HumanLabel,
  humanLabelOf,
} from '@outcomes/domain/services/human-label';
import {
  type Agreement,
  agreementOf,
  type Coverage,
  claimsAgreementOf,
  coverageOf,
  type ScorePair,
  type TrendPoint,
  trendOf,
} from '@outcomes/domain/services/judge-agreement';
import {
  calibrationOf,
  type JudgeCalibration,
  unreadableRubricCalibration,
} from '@outcomes/domain/services/judge-calibration';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface RubricReport {
  readonly rubricVersion: string;
  readonly scale: ScoreScale;
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
  readonly scale: ScoreScale | null;
  readonly trust: number;
}

interface Labelling {
  readonly records: ReadonlyMap<string, RunRecord>;
  readonly deliveries: ReadonlyMap<string, TaskDelivery>;
  readonly grades: ReadonlyMap<string, readonly Score[]>;
}

const humanFor = (
  runId: string,
  scale: ScoreScale,
  rubricVersion: string | null,
  labelling: Labelling,
): HumanLabel | null => {
  const record = labelling.records.get(runId) ?? null;
  const taskId = record?.taskId?.value;

  return humanLabelOf({
    scale,
    rubricVersion,
    record,
    delivery: taskId ? (labelling.deliveries.get(taskId) ?? null) : null,
    grades: labelling.grades.get(runId) ?? [],
  });
};

const labelFor = (
  runId: string,
  scale: ScoreScale,
  rubricVersion: string | null,
  labelling: Labelling,
): number | null =>
  humanFor(runId, scale, rubricVersion, labelling)?.value ?? null;

const reportOf = (
  rubricVersion: string,
  judged: readonly Score[],
  labelling: Labelling,
): RubricReport => {
  const scale = (judged[0] as Score).scale;
  const humans = judged.map((score) => ({
    score,
    label: humanFor(score.runId.value, scale, rubricVersion, labelling),
  }));
  const labelled = humans.map(({ score, label }) => ({
    score,
    human: label?.value ?? null,
  }));
  const pairs: ScorePair[] = labelled.flatMap(({ score, human }) =>
    human === null ? [] : [{ judge: score.value, human }],
  );
  const claimPairs = humans.flatMap(({ score, label }) =>
    score.marks && label?.marks
      ? [{ judge: score.marks, human: label.marks }]
      : [],
  );
  const times = judged.map((each) => each.at.getTime());

  return {
    rubricVersion,
    scale,
    judged: judged.length,
    agreement: scale.byClaims
      ? claimsAgreementOf(claimPairs)
      : agreementOf(scale, pairs),
    trend: trendOf(
      labelled.map(({ score, human }) => ({
        at: score.at,
        judge: score.value,
        human,
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
  judged: readonly Score[];
  grades: readonly Score[];
  records: readonly RunRecord[];
  covering: readonly RunRecord[];
  deliveries: readonly TaskDelivery[];
}): JudgeReport => {
  const labelling: Labelling = {
    records: new Map(input.records.map((each) => [each.runId.value, each])),
    deliveries: new Map(
      input.deliveries.map((each) => [each.taskId.value, each]),
    ),
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
        .map((record) => {
          const judged = judgedRuns.get(record.runId.value) ?? [];
          const scale = judged[0]?.scale ?? ScoreScale.yesNo();

          return {
            judged: judged.length > 0,
            labelled:
              labelFor(
                record.runId.value,
                scale,
                judged[0]?.rubricVersion ?? null,
                labelling,
              ) !== null,
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
  if (!current.scale) {
    return unreadableRubricCalibration(current.trust);
  }

  const version = report.versions.find(
    (each) => each.rubricVersion === current.rubricVersion,
  );

  return calibrationOf({
    trust: current.trust,
    scale: current.scale,
    agreement:
      version?.agreement ??
      (current.scale.byClaims
        ? claimsAgreementOf([])
        : agreementOf(current.scale, [])),
  });
};
