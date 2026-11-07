import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type {
  StationJudge,
  StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import {
  calibrationIn,
  type JudgeReport,
  judgeReportOf,
} from '@insights/domain/services/judge-report';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamOfStations {
  readonly workspaceId: string;
  readonly teamId: string;
}

export interface StationOnLine {
  readonly lineId: string;
  readonly stationId: string;
}

export interface JudgeCalibrationShape {
  readonly stationId: string;
  readonly rubricVersion: string | null;
  readonly qualified: boolean;
  readonly measure: 'kappa' | 'spearman' | null;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly minAgreement: number | null;
  readonly hiddenReason:
    | 'no-judge'
    | 'unreadable-rubric'
    | 'too-few-pairs'
    | 'no-agreement'
    | 'below-min-agreement'
    | null;
}

const MAX_JUDGED = 500;

const MAX_RECORDS = 200;

export interface StationLocation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
}

export type CurrentStationJudge = StationJudge & {
  readonly scale: ScoreScale | null;
  readonly rubricBody: string | null;
};

export interface CurrentCalibration {
  readonly rubricVersion: string | null;
  readonly calibration: JudgeCalibration;
}

export interface StationJudgement {
  readonly judge: CurrentStationJudge | null;
  readonly report: JudgeReport;
  readonly calibration: JudgeCalibration;
}

interface Labels {
  readonly facts: readonly RunFact[];
  readonly grades: readonly ScoreFact[];
}

const currentOf = (
  station: { teamId: TeamId; lineId: LineId },
  judge: StationJudge | null,
): CurrentStationJudge | null => {
  if (
    !judge ||
    judge.teamId !== station.teamId.value ||
    judge.lineId !== station.lineId.value
  ) {
    return null;
  }

  const rubric = Rubric.readable({
    text: judge.rubric,
    claims: judge.claims,
    passThreshold: judge.passThreshold,
    version: judge.rubricVersion,
  });

  return {
    ...judge,
    scale: rubric?.scale ?? null,
    rubricBody: rubric?.body ?? null,
  };
};

const calibrationFrom = (
  judged: readonly ScoreFact[],
  labels: Labels,
  judge: CurrentStationJudge | null,
): JudgeCalibration =>
  calibrationIn(judgeReportOf({ judged, covering: [], ...labels }), judge);

export class StationJudgeReports {
  constructor(
    private readonly judges: StationJudgesPort,
    private readonly facts: StationFactsPort,
  ) {}

  async at(station: StationLocation): Promise<StationJudgement> {
    const judge = await this.currentJudge(station);
    const judged = await this.facts.judgedAtStation({
      ...station,
      last: MAX_JUDGED,
    });
    const recent = await this.facts.lastEndedAt({
      ...station,
      last: MAX_RECORDS,
    });
    const report = await this.reportOf(judged, recent);

    return { judge, report, calibration: calibrationIn(report, judge) };
  }

  async calibrationAt(station: StationLocation): Promise<CurrentCalibration> {
    const judge = await this.currentJudge(station);

    return {
      rubricVersion: judge?.rubricVersion ?? null,
      calibration: await this.calibrationFor(station, judge),
    };
  }

  async currentJudge(station: {
    teamId: TeamId;
    lineId: LineId;
    stationId: StationId;
  }): Promise<CurrentStationJudge | null> {
    return currentOf(
      station,
      await this.judges.judgeAt(station.stationId.value),
    );
  }

  async calibrationsOf(
    team: TeamOfStations,
    stations: readonly StationOnLine[],
  ): Promise<readonly JudgeCalibrationShape[]> {
    const teamId = TeamId.of(team.teamId);
    const judges = await this.judges.judgesOnTeam(team.teamId);
    const current = stations.map((station) => ({
      station,
      judge: currentOf(
        { teamId, lineId: LineId.of(station.lineId) },
        judges.get(station.stationId) ?? null,
      ),
    }));
    const judged = await this.facts.judgedAtStations({
      workspaceId: WorkspaceId.of(team.workspaceId),
      teamId,
      stations: current.flatMap(({ station, judge }) =>
        judge?.scale
          ? [
              {
                lineId: LineId.of(station.lineId),
                stationId: StationId.of(station.stationId),
                rubricVersion: judge.rubricVersion,
              },
            ]
          : [],
      ),
      last: MAX_JUDGED,
    });
    const labels = await this.labelsFor(judged, []);

    return current.map(({ station, judge }) => ({
      stationId: station.stationId,
      rubricVersion: judge?.rubricVersion ?? null,
      ...calibrationFrom(
        judged.filter(
          (each) =>
            each.location.lineId.value === station.lineId &&
            each.location.stationId.value === station.stationId,
        ),
        labels,
        judge,
      ),
    }));
  }

  private async calibrationFor(
    station: StationLocation,
    judge: CurrentStationJudge | null,
  ): Promise<JudgeCalibration> {
    const judged = judge?.scale
      ? await this.facts.judgedAtStation({
          ...station,
          rubricVersion: judge.rubricVersion,
          last: MAX_JUDGED,
        })
      : [];

    return calibrationFrom(judged, await this.labelsFor(judged, []), judge);
  }

  private async reportOf(
    judged: readonly ScoreFact[],
    recent: readonly RunFact[],
  ): Promise<JudgeReport> {
    return judgeReportOf({
      judged,
      covering: recent,
      ...(await this.labelsFor(judged, recent)),
    });
  }

  private async labelsFor(
    judged: readonly ScoreFact[],
    recent: readonly RunFact[],
  ): Promise<Labels> {
    const known = new Set(recent.map((each) => each.runId.value));
    const facts = [
      ...recent,
      ...(await this.facts.ofRuns(
        judged
          .map((each) => each.runId)
          .filter((each) => !known.has(each.value)),
      )),
    ];
    const runIds = [
      ...new Set([...facts, ...judged].map((each) => each.runId.value)),
    ].map(RunId.of);
    const grades = (await this.facts.scoresOfRuns(runIds)).filter(
      (each) => !each.fromJudge,
    );

    return { facts, grades };
  }
}
