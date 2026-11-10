import type { CitedReason } from '@replays/domain/value-objects/judge-verdict.vo';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';

export interface JudgedChange {
  readonly judged: true;
  readonly value: number;
  readonly claimResults: readonly boolean[] | null;
  readonly reasons: readonly CitedReason[];
  readonly guidance: string | null;
  readonly referenced: boolean;
  readonly model: string;
}

export interface Unjudged {
  readonly judged: false;
  readonly failure: JudgingFailureCode;
}

export type ChangeJudgment = JudgedChange | Unjudged;
