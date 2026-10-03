import type {
  EvidencePort,
  StationJudge,
} from '@outcomes/application/ports/evidence.port';
import type {
  JudgeStandingPort,
  JudgeStandingShape,
  StationOnTeam,
} from '@outcomes/application/ports/judge-standing.port';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import {
  type JudgeReport,
  judgeReportOf,
  standingIn,
} from '@outcomes/domain/services/judge-report';
import type { JudgeStanding } from '@outcomes/domain/services/judge-standing';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MOST_JUDGED = 500;

const MOST_RECORDS = 200;

export interface StationPlace {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
}

export type CurrentStationJudge = StationJudge & {
  readonly scale: ScoreScale | null;
};

export interface CurrentStanding {
  readonly rubricVersion: string | null;
  readonly standing: JudgeStanding;
}

export interface StationJudgement {
  readonly judge: CurrentStationJudge | null;
  readonly report: JudgeReport;
  readonly standing: JudgeStanding;
}

export class StationJudgeReports implements JudgeStandingPort {
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
      last: MOST_JUDGED,
    });
    const recent = await this.records.lastAtStation({
      ...station,
      last: MOST_RECORDS,
    });
    const report = await this.reportOf(judged, recent);

    return { judge, report, standing: standingIn(report, judge) };
  }

  async standingAt(station: StationPlace): Promise<CurrentStanding> {
    const judge = await this.currentJudge(station);

    return {
      rubricVersion: judge?.rubricVersion ?? null,
      standing: await this.standingFor(station, judge),
    };
  }

  async currentJudge(station: {
    teamId: TeamId;
    lineId: string;
    stationId: string;
  }): Promise<CurrentStationJudge | null> {
    const judge = await this.evidence.judgeAt(station.stationId);

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

    return { ...judge, scale: rubric?.scale ?? null };
  }

  async of(station: StationOnTeam): Promise<JudgeStandingShape> {
    const place = {
      workspaceId: WorkspaceId.of(station.workspaceId),
      teamId: TeamId.of(station.teamId),
      lineId: station.lineId,
      stationId: station.stationId,
    };
    const judge = await this.currentJudge(place);

    return {
      stationId: station.stationId,
      rubricVersion: judge?.rubricVersion ?? null,
      ...(await this.standingFor(place, judge)),
    };
  }

  private async standingFor(
    station: StationPlace,
    judge: CurrentStationJudge | null,
  ): Promise<JudgeStanding> {
    const judged = judge?.scale
      ? await this.scores.judgedAtStation({
          ...station,
          rubricVersion: judge.rubricVersion,
          last: MOST_JUDGED,
        })
      : [];

    return standingIn(await this.reportOf(judged, []), judge);
  }

  private async reportOf(
    judged: readonly Score[],
    recent: readonly RunRecord[],
  ): Promise<JudgeReport> {
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

    return judgeReportOf({
      judged,
      grades,
      records,
      covering: recent,
      deliveries,
    });
  }
}
