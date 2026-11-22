import type {
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_JUDGMENTS = Symbol('CHANGE_JUDGMENTS');

/**
 * Which judgment of a run's change this is, as the asker counts it: which judging of the run, and which try of that
 * judging. A new round orders a new judging session; the same round reads its session back.
 */
export interface ChangeJudgmentRound {
  readonly runId: RunId;
  readonly judging: number;
  readonly attempt: number;
}

export interface ChangeJudgmentOrder {
  readonly workspaceId: string;
  readonly round: ChangeJudgmentRound;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly guidanceRequested: boolean;
  readonly effectsBlocked: boolean;
}

interface ChangeJudgmentReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
  readonly claim: number | null;
}

export interface UnjudgedJudgment {
  readonly judged: false;
  readonly failure: JudgingFailureCode;
}

export type ChangeJudgment =
  | {
      readonly judged: true;
      readonly claimResults: readonly boolean[];
      readonly reasons: readonly ChangeJudgmentReason[];
      readonly guidance: string | null;
      readonly referenced: boolean;
      readonly model: string;
    }
  | UnjudgedJudgment;

export interface ChangeJudgmentsPort {
  /** Answers waiting while the judging session has not submitted its verdict. */
  judge(order: ChangeJudgmentOrder): Promise<ChangeJudgment | SessionWaiting>;

  /** The round a settled session judged, or null when it judged no change for an asker. */
  roundOf(session: SettledSession): ChangeJudgmentRound | null;
}
