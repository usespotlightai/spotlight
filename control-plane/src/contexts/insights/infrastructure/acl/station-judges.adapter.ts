import { createHash } from 'node:crypto';
import type {
  StationJudge,
  StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import type {
  LineView,
  StationJudgeView,
} from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const rubricVersionOf = (judge: StationJudgeView): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        rubric: judge.rubric,
        claims: judge.claims,
        passThreshold: judge.passThreshold,
      }),
    )
    .digest('hex');

const judgeOf = (line: LineView, judge: StationJudgeView): StationJudge => ({
  teamId: line.teamId,
  lineId: line.id,
  rubric: judge.rubric,
  claims: judge.claims,
  passThreshold: judge.passThreshold,
  rubricVersion: rubricVersionOf(judge),
  sample: judge.sample,
  minAgreement: judge.minAgreement,
});

export class StationJudges implements StationJudgesPort {
  constructor(private readonly lines: LinesPort) {}

  async judgeAt(stationId: string): Promise<StationJudge | null> {
    const line = await this.lines.findByStation(StationId.of(stationId));
    const judge =
      line?.stations.find((each) => each.id === stationId)?.judge ?? null;

    return line && judge ? judgeOf(line, judge) : null;
  }

  async judgesOnTeam(
    teamId: string,
  ): Promise<ReadonlyMap<string, StationJudge>> {
    const lines = await this.lines.ofTeam(TeamId.of(teamId));

    return new Map(
      lines.flatMap((line) =>
        line.stations.flatMap((station) =>
          station.judge
            ? [[station.id, judgeOf(line, station.judge)] as const]
            : [],
        ),
      ),
    );
  }
}
