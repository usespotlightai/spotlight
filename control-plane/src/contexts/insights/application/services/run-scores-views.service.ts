import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import type {
  CitationDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@insights/application/dto/run-scores.dto';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import { visibleJudgeOf } from '@insights/domain/services/judge-verdict';
import type { Citation } from '@insights/domain/value-objects/citation.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { firstOf } from '@shared-kernel/domain/item-at';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const citationOf = (citation: Citation, seen: SeenEvidence): CitationDto => {
  if (citation.kind === 'step') {
    const step = citation.step ?? 0;
    const seenStep = seen.stepAt(step);

    return {
      kind: 'step',
      step: {
        index: step,
        kind: seenStep?.kind ?? null,
        tool: seenStep?.tool ?? null,
        text: seenStep?.text ?? null,
      },
      hunk: null,
    };
  }

  const hunk = citation.hunk ?? '';
  const seenHunk = seen.hunkOf(hunk);

  return {
    kind: 'hunk',
    step: null,
    hunk: {
      id: hunk,
      path: seenHunk?.path ?? null,
      header: seenHunk?.header ?? null,
      lines: seenHunk?.lines ?? [],
    },
  };
};

const judgeOf = (score: Scored, claims: readonly string[]): JudgeScoreDto => ({
  claims: [...claims],
  value: score.value,
  claimResults: [...score.claimResults],
  passes: score.passes,
  rubricVersion: score.rubricVersion,
  model: score.model,
  at: score.at.toISOString(),
  reasons: score.reasons.map((reason) => ({
    text: reason.text,
    claim: reason.claim,
    citations: reason.citations.map((each) => citationOf(each, score.seen)),
  })),
});

export class RunScoresViews {
  constructor(
    private readonly facts: StationFactsPort,
    private readonly reports: StationJudgeReports,
  ) {}

  async of(access: ViewedTeam, runId: string): Promise<RunScoresDto> {
    const run = firstOf(await this.facts.ofRuns([RunId.of(runId)]));

    if (
      run === undefined ||
      !access.covers(run.workspaceId, run.end.location.teamId)
    ) {
      throw new UnknownRunError(runId);
    }

    const scores = await this.facts.scoresOfRuns([run.runId]);
    const { rubricVersion, rubric, calibration } =
      await this.reports.calibrationAt({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: run.end.location.lineId,
        stationId: run.end.location.stationId,
      });
    const judge = visibleJudgeOf(scores, calibration, rubricVersion);
    const label = run.humanLabel;

    return {
      runId: run.runId.value,
      taskId: run.end.location.taskId.value,
      stationId: run.end.location.stationId.value,
      judged: scores.length > 0,
      judge: judge && rubric ? judgeOf(judge, rubric.claims) : null,
      calibration: judgeCalibrationOf(calibration),
      labelFrom: label?.from ?? null,
      agrees: judge && label ? label.agreesWith(judge) : null,
    };
  }
}
