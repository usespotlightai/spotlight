import type { JudgeStandingPort } from '@outcomes/application/ports/judge-standing.port';
import type { JudgeStanding } from '@outcomes/domain/services/judge-standing';
import type { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import type { StationPlace } from '@outcomes/domain/services/team-history';

export interface StationJudgeStanding extends StationPlace, JudgeStanding {
  readonly rubricVersion: string | null;
}

export interface JudgeStandings {
  readonly judges: readonly StationJudgeStanding[];
  readonly trusted: ReadonlyMap<string, string>;
}

export class TrustedJudges {
  constructor(private readonly standing: JudgeStandingPort) {}

  async standings(
    clearance: OutcomesClearance,
    stations: readonly StationPlace[],
  ): Promise<JudgeStandings> {
    const shapes = await this.standing.standingsOf(
      {
        workspaceId: clearance.workspaceId.value,
        teamId: clearance.teamId.value,
      },
      stations.map((station) => ({
        lineId: station.lineId,
        stationId: station.stationId,
      })),
    );
    const byStation = new Map(shapes.map((each) => [each.stationId, each]));
    const judges = stations.flatMap((station) => {
      const shape = byStation.get(station.stationId);

      return !shape || shape.hiddenBecause === 'no-judge'
        ? []
        : [
            {
              lineId: station.lineId,
              stationId: station.stationId,
              rubricVersion: shape.rubricVersion,
              trusted: shape.trusted,
              measure: shape.measure,
              agreement: shape.agreement,
              pairs: shape.pairs,
              trust: shape.trust,
              hiddenBecause: shape.hiddenBecause,
            },
          ];
    });

    return {
      judges,
      trusted: new Map(
        judges.flatMap((each) =>
          each.trusted && each.rubricVersion !== null
            ? [[each.stationId, each.rubricVersion] as const]
            : [],
        ),
      ),
    };
  }
}
