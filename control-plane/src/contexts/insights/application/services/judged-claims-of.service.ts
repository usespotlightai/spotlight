import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import { currentJudgeOf } from '@insights/application/services/current-station-judge';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import { judgedClaimsOf } from '@insights/domain/services/judged-claims';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class JudgedClaimsOf {
  constructor(
    private readonly judges: StationJudgesPort,
    private readonly judgings: JudgingRepository,
  ) {}

  async of(
    run: { readonly runId: RunId; readonly end: RunEnd },
    judge: Scored | null,
  ): Promise<readonly (string | null)[]> {
    if (!judge) {
      return [];
    }

    const { location } = run.end;

    return judgedClaimsOf(
      judge,
      currentJudgeOf(location, await this.judges.judgeAt(location.stationId))
        ?.rubric ?? null,
      (await this.judgings.of(run.runId))?.rubric ?? null,
    );
  }
}
