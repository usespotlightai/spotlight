import type {
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { ClaimAnswerKind } from '@insights/domain/value-objects/claim-answer.vo';
import type { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import type { DisagreementDirection } from '@insights/domain/value-objects/disagreement-direction';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

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
  readonly round: ClaimsRevisionRound;
  /** The run whose harness and working copy the drafting session starts from. */
  readonly draftedFrom: RunId;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly cases: readonly DisagreementCase[];
  readonly maxCandidates: number;
}

export type ClaimsDrafts =
  | {
      readonly status: 'drafted';
      readonly candidates: readonly (readonly string[])[];
    }
  /** The drafting session has nowhere to run: no harness, or a run of another workspace. */
  | { readonly status: 'unavailable' }
  /** The drafting session failed, or submitted drafts that cannot be read. */
  | { readonly status: 'failed' };

export interface ClaimsDrafterPort {
  /** Answers waiting while the drafting session has not submitted its drafts. */
  drafted(request: ClaimsDraftRequest): Promise<ClaimsDrafts | SessionWaiting>;

  /** The round a settled session drafted for, or null when it is no drafting session. */
  roundOf(session: SettledSession): ClaimsRevisionRound | null;
}
