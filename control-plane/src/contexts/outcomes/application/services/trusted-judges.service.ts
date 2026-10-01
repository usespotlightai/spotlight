import type { JudgeStandingPort } from '@outcomes/application/ports/judge-standing.port';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import { shareOf } from '@outcomes/domain/services/judge-shares';
import type { JudgeStanding } from '@outcomes/domain/services/judge-standing';
import type { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import type { StationPlace } from '@outcomes/domain/services/team-history';

export interface StationJudgeStanding extends StationPlace, JudgeStanding {
  readonly rubricVersion: string | null;
}

export interface TrustedJudging {
  readonly judges: readonly StationJudgeStanding[];
  readonly shares: ReadonlyMap<string, number>;
}

export class TrustedJudges {
  constructor(
    private readonly standing: JudgeStandingPort,
    private readonly scores: ScoreRepository,
  ) {}

  async of(
    clearance: OutcomesClearance,
    stations: readonly StationPlace[],
    records: readonly RunRecord[],
  ): Promise<TrustedJudging> {
    const judges: StationJudgeStanding[] = [];

    for (const station of stations) {
      const shape = await this.standing.of({
        workspaceId: clearance.workspaceId.value,
        teamId: clearance.teamId.value,
        lineId: station.lineId,
        stationId: station.stationId,
      });

      if (shape.hiddenBecause !== 'no-judge') {
        judges.push({
          lineId: station.lineId,
          stationId: station.stationId,
          rubricVersion: shape.rubricVersion,
          trusted: shape.trusted,
          measure: shape.measure,
          agreement: shape.agreement,
          pairs: shape.pairs,
          trust: shape.trust,
          hiddenBecause: shape.hiddenBecause,
        });
      }
    }

    const trusted = new Map(
      judges
        .filter((each) => each.trusted && each.rubricVersion !== null)
        .map((each) => [each.stationId, each.rubricVersion]),
    );
    const judged = records.filter((each) => {
      const stationId = each.end?.place.stationId;
      return stationId !== undefined && trusted.has(stationId);
    });
    const scores =
      judged.length === 0
        ? []
        : await this.scores.ofRuns(judged.map((each) => each.runId));

    return {
      judges,
      shares: new Map(
        scores
          .filter(
            (each) =>
              each.fromJudge &&
              trusted.get(each.place.stationId) === each.rubricVersion,
          )
          .map((each) => [each.runId.value, shareOf(each.scale, each.value)]),
      ),
    };
  }
}
