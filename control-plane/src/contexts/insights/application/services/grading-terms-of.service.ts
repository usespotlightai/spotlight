import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import { currentJudgeOf } from '@insights/application/services/current-station-judge';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import {
  type GradingTerms,
  gradingTermsOf,
} from '@insights/domain/services/grading-terms';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class GradingTermsOf {
  constructor(
    private readonly judges: StationJudgesPort,
    private readonly judgings: JudgingRepository,
  ) {}

  async of(
    run: { readonly runId: RunId; readonly end: RunEnd },
    scores: readonly Scored[],
  ): Promise<GradingTerms> {
    const { location } = run.end;

    return gradingTermsOf(
      scores,
      currentJudgeOf(location, await this.judges.judgeAt(location.stationId)),
      (await this.judgings.of(run.runId))?.rubric ?? null,
    );
  }
}
