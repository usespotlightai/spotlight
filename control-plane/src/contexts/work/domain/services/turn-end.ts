import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { HandoverFor } from '@work/domain/services/handover-for';
import {
  putsItToAPerson,
  routeAfterRun,
} from '@work/domain/services/route-after-run';
import type { Declaration } from '@work/domain/value-objects/declaration.vo';
import type { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export interface TurnEnd {
  readonly waiting: boolean;
  readonly run: Run;
  readonly task: Task | null;
}

interface Turn {
  readonly run: Run;
  readonly task: Task | null;
  readonly line: Line | null;
  readonly outcome: RunOutcome;
  readonly declared: Declaration | null;
}

const handoverOf = (task: Task, { outcome, declared, line }: Turn) =>
  HandoverFor.after({ outcome, declared, line, standingAt: task.stationId });

const asksAPerson = (turn: Turn): boolean => {
  const { run, task, line, outcome } = turn;

  if (!task?.heldBy(run.id) || run.stopRequested || !outcome.handsOver) {
    return false;
  }

  const routing = routeAfterRun(handoverOf(task, turn), line, task);

  return task.awaitingReview || putsItToAPerson(routing);
};

export const turnWaits = (
  turn: Turn & { readonly by: RunnerId; readonly mayBeWithheld: boolean },
): boolean => {
  if (turn.run.pausedBy(turn.by)) {
    return !turn.outcome.stopped;
  }

  const withheld =
    turn.mayBeWithheld && turn.declared
      ? { ...turn, declared: turn.declared.withheld('') }
      : null;

  return asksAPerson(turn) || (withheld !== null && asksAPerson(withheld));
};

export const turnEnded = (turn: {
  run: Run;
  by: RunnerId;
  task: Task | null;
  line: Line | null;
  outcome: RunOutcome;
  report: HandoverReport;
  kept: boolean;
  now: Date;
}): TurnEnd => {
  const { run, by, task, line, outcome, report, kept, now } = turn;

  const asked = { run, task, line, outcome, declared: report.declared };

  if (run.isReplay) {
    return {
      waiting: false,
      run: run.complete(by, outcome, report),
      task: null,
    };
  }

  const waits = turnWaits({ ...asked, by, mayBeWithheld: false });

  if (waits && run.pausedBy(by)) {
    return { waiting: true, run, task: null };
  }

  if (!task || !kept || !waits) {
    return {
      waiting: false,
      run: run.complete(by, outcome, report),
      task: null,
    };
  }

  if (task.undelivered.length > 0) {
    return { waiting: true, run, task: null };
  }

  const worked = report.session ? task.workedIn(report.session, by) : task;

  return {
    waiting: true,
    run: run.paused(by, outcome, report, now),
    task: worked.awaitingReview
      ? worked
      : worked.putToAPersonBy(run.id, {
          station:
            line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
          body: handoverOf(task, asked).body,
          at: now,
          voice: Voice.station(run.id),
        }),
  };
};
