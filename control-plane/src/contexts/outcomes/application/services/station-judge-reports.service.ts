import type {
  EvidencePort,
  StationJudge,
} from '@outcomes/application/ports/evidence.port';
import type {
  JudgeCalibrationPort,
  JudgeCalibrationShape,
  StationOnLine,
  TeamOfStations,
} from '@outcomes/application/ports/judge-calibration.port';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { JudgeCalibration } from '@outcomes/domain/services/judge-calibration';
import {
  calibrationIn,
  type JudgeReport,
  judgeReportOf,
} from '@outcomes/domain/services/judge-report';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MAX_JUDGED = 500;

const MAX_RECORDS = 200;

export interface StationPlace {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
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
  readonly records: readonly RunRecord[];
  readonly grades: readonly Score[];
  readonly deliveries: readonly TaskDelivery[];
}

const currentOf = (
  station: { teamId: TeamId; lineId: string },
  judge: StationJudge | null,
): CurrentStationJudge | null => {
  if (
    !judge ||
    judge.teamId !== station.teamId.value ||
    judge.lineId !== station.lineId
  ) {
    return null;
  }

  const rubric = Rubric.readable({
    text: judge.rubric,
    claims: judge.claims,
    passShare: judge.passShare,
    version: judge.rubricVersion,
  });

  return {
    ...judge,
    scale: rubric?.scale ?? null,
    rubricBody: rubric?.body ?? null,
  };
};

const calibrationFrom = (
  judged: readonly Score[],
  labels: Labels,
  judge: CurrentStationJudge | null,
): JudgeCalibration =>
  calibrationIn(judgeReportOf({ judged, covering: [], ...labels }), judge);

export class StationJudgeReports implements JudgeCalibrationPort {
  constructor(
    private readonly evidence: EvidencePort,
    private readonly scores: ScoreRepository,
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
  ) {}

  async at(station: StationPlace): Promise<StationJudgement> {
    const judge = await this.currentJudge(station);
    const judged = await this.scores.judgedAtStation({
      ...station,
      last: MAX_JUDGED,
    });
    const recent = await this.records.lastAtStation({
      ...station,
      last: MAX_RECORDS,
    });
    const report = await this.reportOf(judged, recent);

    return { judge, report, calibration: calibrationIn(report, judge) };
  }

  async calibrationAt(station: StationPlace): Promise<CurrentCalibration> {
    const judge = await this.currentJudge(station);

    return {
      rubricVersion: judge?.rubricVersion ?? null,
      calibration: await this.calibrationFor(station, judge),
    };
  }

  async currentJudge(station: {
    teamId: TeamId;
    lineId: string;
    stationId: string;
  }): Promise<CurrentStationJudge | null> {
    return currentOf(station, await this.evidence.judgeAt(station.stationId));
  }

  async calibrationsOf(
    team: TeamOfStations,
    stations: readonly StationOnLine[],
  ): Promise<readonly JudgeCalibrationShape[]> {
    const teamId = TeamId.of(team.teamId);
    const judges = await this.evidence.judgesOnTeam(team.teamId);
    const current = stations.map((station) => ({
      station,
      judge: currentOf(
        { teamId, ...station },
        judges.get(station.stationId) ?? null,
      ),
    }));
    const judged = await this.scores.judgedAtStations({
      workspaceId: WorkspaceId.of(team.workspaceId),
      teamId,
      stations: current.flatMap(({ station, judge }) =>
        judge?.scale
          ? [
              {
                lineId: station.lineId,
                stationId: station.stationId,
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
            each.place.lineId === station.lineId &&
            each.place.stationId === station.stationId,
        ),
        labels,
        judge,
      ),
    }));
  }

  private async calibrationFor(
    station: StationPlace,
    judge: CurrentStationJudge | null,
  ): Promise<JudgeCalibration> {
    const judged = judge?.scale
      ? await this.scores.judgedAtStation({
          ...station,
          rubricVersion: judge.rubricVersion,
          last: MAX_JUDGED,
        })
      : [];

    return calibrationFrom(judged, await this.labelsFor(judged, []), judge);
  }

  private async reportOf(
    judged: readonly Score[],
    recent: readonly RunRecord[],
  ): Promise<JudgeReport> {
    return judgeReportOf({
      judged,
      covering: recent,
      ...(await this.labelsFor(judged, recent)),
    });
  }

  private async labelsFor(
    judged: readonly Score[],
    recent: readonly RunRecord[],
  ): Promise<Labels> {
    const known = new Set(recent.map((each) => each.runId.value));
    const records = [
      ...recent,
      ...(await this.records.ofRuns(
        judged
          .map((each) => each.runId)
          .filter((each) => !known.has(each.value)),
      )),
    ];
    const runIds = [
      ...new Set([...records, ...judged].map((each) => each.runId.value)),
    ].map(RunId.of);
    const grades = (await this.scores.ofRuns(runIds)).filter(
      (each) => !each.fromJudge,
    );
    const deliveries = await this.deliveries.forTasks(
      records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
    );

    return { records, grades, deliveries };
  }
}
