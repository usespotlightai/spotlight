import type { CitedReason } from '@replays/domain/value-objects/judge-verdict.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';

export interface JudgedChange {
  readonly judged: true;
  readonly value: number;
  readonly claimResults: readonly boolean[] | null;
  readonly reasons: readonly CitedReason[];
  readonly guidance: string | null;
  readonly referenced: boolean;
  readonly model: string;
  readonly spent: ModelSpent;
}

export interface Unjudged {
  readonly judged: false;
  readonly failure: JudgingFailureCode;
  readonly spent: ModelSpent;
}

export type ChangeJudgment = JudgedChange | Unjudged;
