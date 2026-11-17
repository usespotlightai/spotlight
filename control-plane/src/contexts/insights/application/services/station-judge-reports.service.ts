import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import {
  type CurrentStationJudge,
  currentJudgeOf,
} from '@insights/application/services/current-station-judge';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import {
  calibrationIn,
  type JudgeReport,
  judgeReportOf,
} from '@insights/domain/services/judge-report';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
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
  readonly rubricVersion: RubricVersion | null;
  readonly qualified: boolean;
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

export interface CurrentCalibration {
  readonly rubricVersion: RubricVersion | null;
  readonly calibration: JudgeCalibration;
}

export interface StationJudgement {
  readonly judge: CurrentStationJudge | null;
  readonly report: JudgeReport;
  readonly calibration: JudgeCalibration;
}

const calibrationFrom = (
  judged: readonly ScoreFact[],
  facts: readonly RunFact[],
  judge: CurrentStationJudge | null,
): JudgeCalibration =>
  calibrationIn(judgeReportOf({ judged, facts, covering: [] }), judge);

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

  private async currentJudge(station: {
    teamId: TeamId;
    lineId: LineId;
    stationId: StationId;
  }): Promise<CurrentStationJudge | null> {
    return currentJudgeOf(
      station,
      await this.judges.judgeAt(station.stationId),
    );
  }

  async calibrationsOf(
    team: TeamOfStations,
    stations: readonly StationOnLine[],
  ): Promise<readonly JudgeCalibrationShape[]> {
    const teamId = TeamId.of(team.teamId);
    const judges = await this.judges.judgesOnTeam(teamId);
    const current = stations.map((station) => ({
      station,
      judge: currentJudgeOf(
        { teamId, lineId: LineId.of(station.lineId) },
        judges.get(station.stationId) ?? null,
      ),
    }));
    const judged = await this.facts.judgedAtStations({
      workspaceId: WorkspaceId.of(team.workspaceId),
      teamId,
      stations: current.flatMap(({ station, judge }) =>
        judge?.rubric
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
    const facts = await this.factsFor(judged);

    return current.map(({ station, judge }) => ({
      stationId: station.stationId,
      rubricVersion: judge?.rubricVersion ?? null,
      ...calibrationFrom(
        judged.filter(
          (each) =>
            each.location.lineId.value === station.lineId &&
            each.location.stationId.value === station.stationId,
        ),
        facts,
        judge,
      ),
    }));
  }

  private async calibrationFor(
    station: StationLocation,
    judge: CurrentStationJudge | null,
  ): Promise<JudgeCalibration> {
    const judged = judge?.rubric
      ? await this.facts.judgedAtStation({
          ...station,
          rubricVersion: judge.rubricVersion,
          last: MAX_JUDGED,
        })
      : [];

    return calibrationFrom(judged, await this.factsFor(judged), judge);
  }

  private async reportOf(
    judged: readonly ScoreFact[],
    recent: readonly RunFact[],
  ): Promise<JudgeReport> {
    return judgeReportOf({
      judged,
      facts: await this.factsFor(judged, recent),
      covering: recent,
    });
  }

  private async factsFor(
    judged: readonly ScoreFact[],
    recent: readonly RunFact[] = [],
  ): Promise<readonly RunFact[]> {
    const known = new Set(recent.map((each) => each.runId.value));

    return [
      ...recent,
      ...(await this.facts.ofRuns(
        judged
          .map((each) => each.runId)
          .filter((each) => !known.has(each.value)),
      )),
    ];
  }
}
