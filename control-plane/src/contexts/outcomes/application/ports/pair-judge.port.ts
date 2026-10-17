import type { PairVerdict } from '@outcomes/domain/aggregates/pair-judging.aggregate';
import type { ReferenceChange } from '@outcomes/domain/services/judge-evidence';
import type { PairedChange } from '@outcomes/domain/services/pair-evidence';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const PAIR_JUDGE = Symbol('OUTCOMES_PAIR_JUDGE');

export interface PairJudgeRequest {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly title: string;
  readonly description: string | null;
  readonly a: PairedChange;
  readonly b: PairedChange;
  readonly reference: ReferenceChange;
}

export interface PairJudgeAnswer {
  readonly verdict: PairVerdict;
  readonly usage: ModelCall | null;
}

export interface PairJudgePort {
  readonly available: boolean;

  readonly model: string;

  judgePair(request: PairJudgeRequest): Promise<PairJudgeAnswer>;
}
