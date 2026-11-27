import type { JudgeCalibrationDto } from '@insights/application/dto/judge-calibration.dto';
import type { CitationKind } from '@insights/domain/value-objects/citation.vo';
import type { LabelSource } from '@insights/domain/value-objects/label-source';

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
  readonly claim: number | null;
  readonly citations: readonly CitationDto[];
}

export interface JudgeScoreDto {
  readonly claims: readonly string[];
  readonly value: number;
  readonly claimResults: readonly boolean[];
  readonly passes: boolean;
  readonly rubricVersion: string;
  readonly model: string;
  readonly at: string;
  readonly reasons: readonly JudgeReasonDto[];
}

export interface PersonVerdictDto {
  readonly right: boolean;
  readonly reason: string | null;
  readonly by: string;
  readonly byName: string | null;
  readonly at: string;
}

export interface RunScoresDto {
  readonly runId: string;
  readonly taskId: string;
  readonly stationId: string;
  readonly judged: boolean;
  readonly judge: JudgeScoreDto | null;
  readonly calibration: JudgeCalibrationDto;
  readonly labelFrom: LabelSource | null;
  readonly peoplePass: boolean | null;
  readonly personVerdict: PersonVerdictDto | null;
  readonly implicitFrom: LabelSource | null;
  readonly takesVerdict: boolean;
  readonly agrees: boolean | null;
}
