import type { Task } from '@work/domain/aggregates/task.aggregate';
import { HandoverFor } from '@work/domain/services/handover-for';
import {
  putsItToAPerson,
  routeAfterRun,
} from '@work/domain/services/route-after-run';
import {
  checkoutsOf,
  type TaskCheckout,
} from '@work/domain/services/task-checkouts';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { RunResult } from '@work/domain/value-objects/run-result.vo';

export type TurnDecision =
  | { readonly kind: 'keep'; readonly handover: ResolvedHandover }
  | { readonly kind: 'resume'; readonly checkouts: readonly TaskCheckout[] }
  | { readonly kind: 'route'; readonly handover: ResolvedHandover };

export const TurnDecision = {
  after(turn: {
    readonly task: Task;
    readonly line: LineMap | null;
    readonly outcome: RunResult;
    readonly handover: Handover | null;
    readonly lastWords: string | null;
    readonly stopRequested: boolean;
  }): TurnDecision {
    const { task, line } = turn;
    const handover = HandoverFor.after({
      outcome: turn.outcome,
      handover: turn.handover,
      line,
      currentStation: task.stationId,
      lastWords: turn.lastWords,
    });

    if (turn.stopRequested || !turn.outcome.handsOver) {
      return { kind: 'route', handover };
    }

    const asksAPerson =
      task.awaitingReview ||
      putsItToAPerson(routeAfterRun(handover, line, task));

    if (!asksAPerson) {
      return { kind: 'route', handover };
    }

    if (task.unacknowledged.length > 0) {
      return {
        kind: 'resume',
        checkouts: line ? checkoutsOf(task, line) : [],
      };
    }

    return { kind: 'keep', handover };
  },
};
