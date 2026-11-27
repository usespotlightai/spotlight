import type { ChangeJudgmentRound } from '@insights/application/ports/change-judgments.port';
import type {
  SessionFailed,
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type {
  JudgedHunk,
  JudgedStep,
  ReferenceChange,
} from '@insights/domain/services/judge-evidence';
import type { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import type { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const JUDGE = Symbol('INSIGHTS_JUDGE');

/** Which judgment a judging session is for: a new round orders a new session, the same round reads its session back. */
export type JudgeRound =
  | { readonly of: 'judging'; readonly round: JudgingRound }
  | {
      readonly of: 'candidate';
      readonly round: ClaimsRevisionRound;
      /** The candidate's place among the claims lists the round drafted. */
      readonly candidate: number;
      readonly runId: RunId;
    }
  | { readonly of: 'change'; readonly round: ChangeJudgmentRound };

export interface JudgeRequest {
  readonly workspaceId: string;
  readonly round: JudgeRound;
  readonly claims: readonly string[];
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly stepsLeftOut: number;
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
  readonly reference: ReferenceChange | null;
  readonly guidanceRequested: boolean;
  readonly effectsBlocked: boolean;
  /** The tools of the run's station that its sandbox blocked; the briefing names them only where effects were blocked. */
  readonly blockedTools: readonly string[];
}

export interface JudgeAnswer {
  readonly status: 'judged';
  readonly verdict: Verdict;
  readonly guidance: string | null;
  /** The harness and model the judging session ran on. */
  readonly model: string;
}

export interface JudgePort {
  /** Answers waiting while the judging session has not submitted its verdict, and failed when it never will. */
  judge(
    request: JudgeRequest,
  ): Promise<JudgeAnswer | SessionFailed | SessionWaiting>;

  /** The round a settled session judged, or null when it is no judging session. */
  roundOf(session: SettledSession): JudgeRound | null;
}
