import type { PairVerdict } from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import type { ReferenceChange } from '@insights/domain/services/judge-evidence';
import type { PairedChange } from '@insights/domain/services/pair-evidence';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const SIDE_BY_SIDE_JUDGE = Symbol('INSIGHTS_SIDE_BY_SIDE_JUDGE');

export interface SideBySideJudgeRequest {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly title: string;
  readonly description: string | null;
  readonly a: PairedChange;
  readonly b: PairedChange;
  readonly reference: ReferenceChange;
}

export interface SideBySideJudgeAnswer {
  readonly verdict: PairVerdict;
  readonly usage: ModelCall | null;
}

export interface SideBySideJudgePort {
  readonly available: boolean;

  readonly model: string;

  judgePair(request: SideBySideJudgeRequest): Promise<SideBySideJudgeAnswer>;
}
