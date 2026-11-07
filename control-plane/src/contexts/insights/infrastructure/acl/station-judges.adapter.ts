import type {
  StationJudge,
  StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type {
  LineView,
  StationJudgeView,
} from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const judgeOf = (line: LineView, judge: StationJudgeView): StationJudge => ({
  teamId: TeamId.of(line.teamId),
  lineId: LineId.of(line.id),
  rubric: judge.rubric,
  claims: judge.claims,
  passThreshold: judge.passThreshold,
  rubricVersion: RubricVersion.of(judge.rubricVersion),
  sample: judge.sample,
  minAgreement: judge.minAgreement,
});

export class StationJudges implements StationJudgesPort {
  constructor(private readonly lines: LinesPort) {}

  async judgeAt(stationId: StationId): Promise<StationJudge | null> {
    const line = await this.lines.findByStation(stationId);
    const judge =
      line?.stations.find((each) => each.id === stationId.value)?.judge ?? null;

    return line && judge ? judgeOf(line, judge) : null;
  }

  async judgesOnTeam(
    teamId: TeamId,
  ): Promise<ReadonlyMap<string, StationJudge>> {
    const lines = await this.lines.ofTeam(teamId);

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
