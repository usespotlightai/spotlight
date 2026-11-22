import type {
  PairJudgmentOrderKind,
  PairJudgmentRound,
} from '@insights/application/ports/pair-judgments.port';
import type {
  SessionFailed,
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { PairVerdict } from '@insights/domain/services/grounded-pair';
import type { ReferenceChange } from '@insights/domain/services/judge-evidence';
import type { PairedChange } from '@insights/domain/services/pair-evidence';

export const SIDE_BY_SIDE_JUDGE = Symbol('INSIGHTS_SIDE_BY_SIDE_JUDGE');

export interface SideBySideJudgeRequest {
  readonly workspaceId: string;
  readonly round: PairJudgmentRound;
  /** Which pass of the round this is: each order the changes are shown in has a session of its own. */
  readonly pass: PairJudgmentOrderKind;
  readonly claims: readonly string[];
  readonly title: string;
  readonly description: string | null;
  readonly a: PairedChange;
  readonly b: PairedChange;
  readonly reference: ReferenceChange;
}

export interface SideBySideJudgeAnswer {
  readonly status: 'judged';
  readonly verdict: PairVerdict;
  /** The harness and model the judging session ran on. */
  readonly model: string;
}

export interface SideBySideJudgePort {
  /** Answers waiting while the judging session has not submitted its verdict, and failed when it never will. */
  judgePair(
    request: SideBySideJudgeRequest,
  ): Promise<SideBySideJudgeAnswer | SessionFailed | SessionWaiting>;

  /** The round a settled session judged a pass of, or null when it is no pair-judging session. */
  roundOf(session: SettledSession): PairJudgmentRound | null;
}
