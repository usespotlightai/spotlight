import type {
  SessionWaiting,
  SettledSession,
} from '@replays/application/ports/session-outcomes';
import type { ChangeJudgingRound } from '@replays/domain/value-objects/change-judging-round.vo';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_JUDGE = Symbol('REPLAYS_CHANGE_JUDGE');

export interface ChangeJudgeOrder {
  readonly workspaceId: string;
  readonly round: ChangeJudgingRound;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly guidanceRequested: boolean;
}

export interface ChangeJudgePort {
  /** Answers waiting while a judging session has not submitted its verdict. */
  judge(order: ChangeJudgeOrder): Promise<ChangeJudgment | SessionWaiting>;

  /** The round a settled session judged, or null when it judged no change for replays. */
  roundOf(session: SettledSession): ChangeJudgingRound | null;
}
