import type {
  SessionWaiting,
  SettledSession,
} from '@replays/application/ports/session-outcomes';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';
import type { SideBySideJudgingRound } from '@replays/domain/value-objects/side-by-side-judging-round.vo';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_JUDGE = Symbol('REPLAYS_PAIR_JUDGE');

export interface PairJudgeOrder {
  readonly workspaceId: string;
  readonly round: SideBySideJudgingRound;
  readonly reference: RunId;
  readonly criteria: JudgeCriteria;
  readonly orders: readonly PairOrder[];
}

export interface PairJudgePort {
  /** Answers waiting while a judging session has not submitted its verdict. */
  judge(order: PairJudgeOrder): Promise<PairJudgment | SessionWaiting>;

  /** The round a settled session judged a pass of, or null when it judged no pair for replays. */
  roundOf(session: SettledSession): SideBySideJudgingRound | null;
}
