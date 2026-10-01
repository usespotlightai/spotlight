import type {
  CitationDto,
  GradeDto,
  JudgeScoreDto,
  RunScoresDto,
} from '@outcomes/application/dto/run-scores.dto';
import type { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { UnknownRunError } from '@outcomes/domain/exceptions/unknown-run.error';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import {
  type GradingTerms,
  gradingTermsOf,
  latestJudgeOf,
  visibleJudgeOf,
} from '@outcomes/domain/services/grading-terms';
import type { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import type { Citation } from '@outcomes/domain/value-objects/citation.vo';
import type { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ScoredRun {
  readonly record: RunRecord;
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

const judgeOf = (score: Score): JudgeScoreDto => ({
  kind: score.scale.kind,
  value: score.value,
  label: score.scale.labelOf(score.value),
  rubricVersion: score.rubricVersion ?? '',
  model: score.model ?? '',
  at: score.at.toISOString(),
  reasons: score.reasons.map((reason) => ({
    text: reason.text,
    citations: reason.citations.map((each) => citationOf(each, score.seen)),
  })),
});

const gradeOf = (score: Score, viewer: string): GradeDto => ({
  by: score.by?.value ?? '',
  mine: score.by?.value === viewer,
  kind: score.scale.kind,
  value: score.value,
  label: score.scale.labelOf(score.value),
  at: score.at.toISOString(),
});

export class RunScoresViews {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly scores: ScoreRepository,
    private readonly reports: StationJudgeReports,
  ) {}

  async onTeam(
    clearance: OutcomesClearance,
    runId: string,
  ): Promise<ScoredRun> {
    const record = await this.records.of(RunId.of(runId));
    const end = record?.end;

    if (
      !record ||
      !end ||
      !record.workspaceId.equals(clearance.workspaceId) ||
      !end.place.teamId.equals(clearance.teamId)
    ) {
      throw new UnknownRunError(runId);
    }

    return { record, end };
  }

  async gradingTerms(
    run: ScoredRun,
    scores: readonly Score[],
  ): Promise<GradingTerms> {
    if (latestJudgeOf(scores)) {
      return gradingTermsOf(scores, null);
    }

    return gradingTermsOf(
      scores,
      await this.reports.currentJudge({
        teamId: run.end.place.teamId,
        lineId: run.end.place.lineId,
        stationId: run.end.place.stationId,
      }),
    );
  }

  async of(
    clearance: OutcomesClearance,
    run: ScoredRun,
  ): Promise<RunScoresDto> {
    const scores = await this.scores.ofRuns([run.record.runId]);
    const { rubricVersion, standing } = await this.reports.standingAt({
      workspaceId: clearance.workspaceId,
      teamId: clearance.teamId,
      lineId: run.end.place.lineId,
      stationId: run.end.place.stationId,
    });
    const judge = visibleJudgeOf(scores, standing, rubricVersion);

    return {
      runId: run.record.runId.value,
      taskId: run.end.place.taskId.value,
      stationId: run.end.place.stationId,
      kind: (await this.gradingTerms(run, scores)).scale.kind,
      judged: latestJudgeOf(scores) !== null,
      judge: judge ? judgeOf(judge) : null,
      standing,
      grades: scores
        .filter((each) => !each.fromJudge)
        .sort((one, other) => other.at.getTime() - one.at.getTime())
        .map((each) => gradeOf(each, clearance.by.value)),
    };
  }
}
