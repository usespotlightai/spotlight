import type { UnjudgedJudgment } from '@insights/application/ports/change-judgments.port';
import type {
  SessionWaiting,
  SettledSession,
} from '@insights/application/ports/session-outcomes';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_JUDGMENTS = Symbol('PAIR_JUDGMENTS');

const PAIR_JUDGMENT_ORDERS = ['run-first', 'other-first'] as const;

export type PairJudgmentOrderKind = (typeof PAIR_JUDGMENT_ORDERS)[number];

/** Which try at judging two runs side by side this is. A new round orders new sessions, one per order. */
export interface PairJudgmentRound {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly attempt: number;
}

export interface PairJudgmentOrder {
  readonly workspaceId: string;
  readonly round: PairJudgmentRound;
  readonly reference: RunId;
  readonly criteria: JudgeCriteria;
  readonly orders: readonly PairJudgmentOrderKind[];
}

export interface PairJudgmentPass {
  readonly order: PairJudgmentOrderKind;
  readonly winner: 'run' | 'other' | 'tie';
  readonly reasons: readonly {
    readonly text: string;
    readonly runHunks: readonly string[];
    readonly otherHunks: readonly string[];
  }[];
}

export type PairJudgment =
  | {
      readonly judged: true;
      readonly passes: readonly PairJudgmentPass[];
      readonly model: string;
    }
  | UnjudgedJudgment;

export interface PairJudgmentsPort {
  /** Orders every pass's session at once; answers waiting while any has not submitted. */
  judge(order: PairJudgmentOrder): Promise<PairJudgment | SessionWaiting>;

  /** The round a settled session judged a pass of, or null when it judged no pair. */
  roundOf(session: SettledSession): PairJudgmentRound | null;
}
