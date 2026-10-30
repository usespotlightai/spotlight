import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { HandoverFor } from '@work/domain/services/handover-for';
import {
  putsItToAPerson,
  routeAfterRun,
} from '@work/domain/services/route-after-run';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export interface TurnEnd {
  readonly run: Run;
  readonly task: Task | null;
}

interface Turn {
  readonly run: Run;
  readonly task: Task | null;
  readonly line: Line | null;
  readonly outcome: RunOutcome;
  readonly handover: Handover | null;
  readonly lastWords?: string | null;
}

const handoverOf = (task: Task, { outcome, handover, line, lastWords }: Turn) =>
  HandoverFor.after({
    outcome,
    handover,
    line,
    currentStation: task.stationId,
    lastWords,
  });

const asksAPerson = (turn: Turn): boolean => {
  const { run, task, line, outcome } = turn;

  if (!task?.hasCurrentRun(run.id) || run.stopRequested || !outcome.handsOver) {
    return false;
  }

  const routing = routeAfterRun(handoverOf(task, turn), line, task);

  return task.awaitingReview || putsItToAPerson(routing);
};

export const turnEnded = (turn: {
  run: Run;
  by: RunnerId;
  task: Task | null;
  line: Line | null;
  outcome: RunOutcome;
  report: HandoverReport;
  now: Date;
}): TurnEnd => {
  const { run, by, task, line, outcome, report, now } = turn;

  const ending = {
    run,
    task,
    line,
    outcome,
    handover: report.handover,
    lastWords: report.lastWords,
  };

  if (run.leavesNothingBehind || !task || !asksAPerson(ending)) {
    return { run: run.complete(by, outcome, report), task: null };
  }

  if (task.unacknowledged.length > 0) {
    return {
      run: run
        .suspend(by, outcome, report, now, { resumesAtOnce: true })
        .resumed(),
      task: null,
    };
  }

  const suspended = run.suspend(by, outcome, report, now);

  const recorded = report.session
    ? task.recordSession(report.session, by)
    : task;

  return {
    run: suspended,
    task: recorded.awaitingReview
      ? recorded
      : recorded.putToAPerson(run.id, {
          station:
            line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
          body: handoverOf(task, ending).body,
          at: now,
          voice: Voice.station(run.id),
        }),
  };
};
