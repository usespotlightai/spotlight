import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import type {
  CitationDto,
  GradeDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@insights/application/dto/run-scores.dto';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { GradingTermsOf } from '@insights/application/services/grading-terms-of.service';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import {
  latestJudgeOf,
  visibleJudgeOf,
} from '@insights/domain/services/grading-terms';
import type { Citation } from '@insights/domain/value-objects/citation.vo';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { TeamAccess } from '@insights/domain/value-objects/team-access.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunOnTeam {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly end: RunEnd;
}

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

const judgeOf = (score: Scored): JudgeScoreDto => ({
  kind: score.scale.kind,
  value: score.value,
  label: score.scale.labelOf(score.value),
  rubricVersion: score.rubricVersion ?? '',
  model: score.model ?? '',
  at: score.at.toISOString(),
  claimResults: score.claimResults && [...score.claimResults],
  reasons: score.reasons.map((reason) => ({
    text: reason.text,
    claim: reason.claim,
    citations: reason.citations.map((each) => citationOf(each, score.seen)),
  })),
});

const gradeOf = (score: Scored, viewer: string): GradeDto => ({
  by: score.by?.value ?? '',
  mine: score.by?.value === viewer,
  kind: score.scale.kind,
  value: score.value,
  claimResults: score.claimResults && [...score.claimResults],
  label: score.scale.labelOf(score.value),
  at: score.at.toISOString(),
});

export class RunScoresViews {
  constructor(
    private readonly facts: StationFactsPort,
    private readonly reports: StationJudgeReports,
    private readonly terms: GradingTermsOf,
  ) {}

  async onTeam(access: TeamAccess, runId: string): Promise<RunOnTeam> {
    const [fact] = await this.facts.ofRuns([RunId.of(runId)]);

    if (!fact || !access.covers(fact.workspaceId, fact.end.location.teamId)) {
      throw new UnknownRunError(runId);
    }

    return { runId: fact.runId, workspaceId: fact.workspaceId, end: fact.end };
  }

  async of(access: TeamAccess, run: RunOnTeam): Promise<RunScoresDto> {
    const scores = await this.facts.scoresOfRuns([run.runId]);
    const { rubricVersion, calibration } = await this.reports.calibrationAt({
      workspaceId: access.workspaceId,
      teamId: access.teamId,
      lineId: run.end.location.lineId,
      stationId: run.end.location.stationId,
    });
    const judge = visibleJudgeOf(scores, calibration, rubricVersion);
    const terms = await this.terms.of(run, scores);

    return {
      runId: run.runId.value,
      taskId: run.end.location.taskId.value,
      stationId: run.end.location.stationId.value,
      kind: terms.scale.kind,
      rubricBody: terms.rubricBody,
      claims: [...terms.claims],
      judged: latestJudgeOf(scores) !== null,
      judge: judge ? judgeOf(judge) : null,
      calibration: judgeCalibrationOf(calibration),
      grades: scores
        .filter((each) => !each.fromJudge)
        .sort((one, other) => other.at.getTime() - one.at.getTime())
        .map((each) => gradeOf(each, access.by.value)),
    };
  }
}
