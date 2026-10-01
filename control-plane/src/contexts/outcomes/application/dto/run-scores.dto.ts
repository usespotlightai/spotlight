import type { JudgeStanding } from '@outcomes/domain/services/judge-standing';
import type { CitationKind } from '@outcomes/domain/value-objects/citation.vo';
import type { ScoreKind } from '@outcomes/domain/value-objects/score-scale.vo';

export interface CitedStepDto {
  readonly index: number;
  readonly kind: string | null;
  readonly tool: string | null;
  readonly text: string | null;
}

export interface CitedHunkDto {
  readonly id: string;
  readonly path: string | null;
  readonly header: string | null;
  readonly lines: readonly string[];
}

export interface CitationDto {
  readonly kind: CitationKind;
  readonly step: CitedStepDto | null;
  readonly hunk: CitedHunkDto | null;
}

export interface JudgeReasonDto {
  readonly text: string;
  readonly citations: readonly CitationDto[];
}

export interface JudgeScoreDto {
  readonly kind: ScoreKind;
  readonly value: number;
  readonly label: string;
  readonly rubricVersion: string;
  readonly model: string;
  readonly at: string;
  readonly reasons: readonly JudgeReasonDto[];
}

export interface GradeDto {
  readonly by: string;
  readonly mine: boolean;
  readonly kind: ScoreKind;
  readonly value: number;
  readonly label: string;
  readonly at: string;
}

export interface RunScoresDto {
  readonly runId: string;
  readonly taskId: string;
  readonly stationId: string;
  readonly kind: ScoreKind;
  readonly judged: boolean;
  readonly judge: JudgeScoreDto | null;
  readonly standing: JudgeStanding;
  readonly grades: readonly GradeDto[];
}
