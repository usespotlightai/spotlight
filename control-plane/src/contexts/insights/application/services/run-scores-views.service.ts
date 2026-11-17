import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import type {
  CitationDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@insights/application/dto/run-scores.dto';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { JudgedClaimsOf } from '@insights/application/services/judged-claims-of.service';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import {
  humanLabelOf,
  judgeAgreesOf,
} from '@insights/domain/services/human-label';
import { visibleJudgeOf } from '@insights/domain/services/judge-verdict';
import type { Citation } from '@insights/domain/value-objects/citation.vo';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunOnTeam {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly end: RunEnd;
  readonly fact: RunFact;
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

const labelOf = (score: Scored): string => {
  const claims = score.claimResults.length;

  return `${score.claimResults.filter(Boolean).length} of ${claims} ${claims === 1 ? 'claim' : 'claims'} met`;
};

const judgeOf = (score: Scored): JudgeScoreDto => ({
  value: score.value,
  claimResults: [...score.claimResults],
  passes: score.passes,
  label: labelOf(score),
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
    private readonly claims: JudgedClaimsOf,
  ) {}

  async onTeam(access: ViewedTeam, runId: string): Promise<RunOnTeam> {
    const [fact] = await this.facts.ofRuns([RunId.of(runId)]);

    if (!fact || !access.covers(fact.workspaceId, fact.end.location.teamId)) {
      throw new UnknownRunError(runId);
    }

    return {
      runId: fact.runId,
      workspaceId: fact.workspaceId,
      end: fact.end,
      fact,
    };
  }

  async of(access: ViewedTeam, run: RunOnTeam): Promise<RunScoresDto> {
    const scores = await this.facts.scoresOfRuns([run.runId]);
    const { rubricVersion, calibration } = await this.reports.calibrationAt({
      workspaceId: access.workspaceId,
      teamId: access.teamId,
      lineId: run.end.location.lineId,
      stationId: run.end.location.stationId,
    });
    const judge = visibleJudgeOf(scores, calibration, rubricVersion);
    const label = humanLabelOf(run.fact);

    return {
      runId: run.runId.value,
      taskId: run.end.location.taskId.value,
      stationId: run.end.location.stationId.value,
      claims: [...(await this.claims.of(run, judge))],
      judged: scores.length > 0,
      judge: judge ? judgeOf(judge) : null,
      calibration: judgeCalibrationOf(calibration),
      outcome: label && { source: label.from, passes: label.passes },
      agrees: judgeAgreesOf(judge, label),
    };
  }
}
