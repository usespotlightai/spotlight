import type { ClaimAnswerKind } from '@insights/domain/value-objects/claim-answer.vo';
import type { DisagreementDirection } from '@insights/domain/value-objects/disagreement-direction';

export const CLAIMS_DRAFTER = Symbol('INSIGHTS_CLAIMS_DRAFTER');

export interface DisagreementCase {
  readonly direction: DisagreementDirection;
  readonly claimResults: readonly boolean[];
  readonly reasons: readonly {
    readonly claim: number | null;
    readonly text: string;
  }[];
  readonly answers: readonly {
    readonly claim: number;
    readonly answer: ClaimAnswerKind;
    readonly note: string | null;
  }[];
  readonly note: string | null;
  readonly shouldHaveFailed: number | null;
}

export interface ClaimsDraftRequest {
  readonly workspaceId: string;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly cases: readonly DisagreementCase[];
  readonly maxCandidates: number;
}

export interface ClaimsDrafterPort {
  availableTo(workspaceId: string): Promise<boolean>;

  drafted(request: ClaimsDraftRequest): Promise<readonly (readonly string[])[]>;
}
