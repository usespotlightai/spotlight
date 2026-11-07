import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunFactsPort } from '@work/application/ports/run-facts.port';
import type {
  RunTurnsPort,
  TurnFacts,
  TurnsCursor,
} from '@work/application/ports/run-turns.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { runCheckoutsFor } from '@work/domain/services/task-checkouts';
import { TurnWait } from '@work/domain/services/turn-wait';

const MINUTE_MS = 60_000;

const PAGE = 100;

export const STUCK_TURNS_METRIC = 'spotlight.turns.stuck';

export class Turns {
  constructor(
    private readonly turns: RunTurnsPort,
    private readonly facts: RunFactsPort,
    private readonly runs: RunsPort,
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly taking: TakeTurn,
    private readonly telemetry: TelemetryPort,
    private readonly logger: LoggerPort,
  ) {}

  async retakePending(now: Date, previously: Date): Promise<void> {
    for await (const turn of this.olderThan(
      'pending',
      TurnWait.firstRetakeAfter(now),
    )) {
      const age = now.getTime() - turn.suspendedAt.getTime();
      const was = previously.getTime() - turn.suspendedAt.getTime();

      if (TurnWait.retakesBetween(was, age)) {
        await this.retaken(turn);
      }

      if (TurnWait.givesUpBetween(was, age)) {
        this.telemetry.count(STUCK_TURNS_METRIC);
        this.logger.error(
          { runId: turn.runId.value, suspendedAt: turn.suspendedAt },
          'A run has waited a day for Spotlight to decide its turn; an operator must look at it',
        );
      }
    }
  }

  async resumeAnswered(now: Date): Promise<void> {
    const answered = await this.tasks.withTurnAnsweredBetween(
      TurnWait.answeredResumeUntil(now),
      new Date(now.getTime() - TurnWait.ANSWER_GRACE_MS),
    );
    const facts = new Map(
      (
        await this.facts.of(
          answered.flatMap((task) =>
            task.currentRunId ? [task.currentRunId] : [],
          ),
        )
      ).map((each) => [each.runId.value, each]),
    );

    for (const task of answered) {
      const run = task.currentRunId ? facts.get(task.currentRunId.value) : null;

      if (run?.turn !== 'kept' || !task.takesUp(run.runId)) {
        continue;
      }

      const line = await this.lines.findByStation(task.stationId);

      await this.runs.resume(
        run.runId,
        run.attempt,
        'answered',
        line ? runCheckoutsFor(task, line) : [],
      );
    }
  }

  async cancelAbandoned(now: Date): Promise<void> {
    for await (const turn of this.olderThan(
      'kept',
      new Date(now.getTime() - TurnWait.ABANDONED_AFTER_MS),
    )) {
      const subject = (await this.dispatches.find(turn.runId))?.subject;
      const task =
        subject?.kind === 'task' ? await this.tasks.find(subject.taskId) : null;

      if (!task?.hasCurrentRun(turn.runId)) {
        await this.runs.cancel(turn.runId);
      }
    }
  }

  private async retaken(turn: TurnFacts): Promise<void> {
    try {
      await this.taking.take(turn.runId, turn.attempt);
    } catch (error) {
      this.logger.warn(
        { err: error, runId: turn.runId.value },
        'The turn of a run could not be decided again; it is tried later',
      );
    }
  }

  private async *olderThan(
    state: 'pending' | 'kept',
    before: Date,
  ): AsyncGenerator<TurnFacts> {
    let after: TurnsCursor | null = null;

    for (;;) {
      const page = await this.turns.ofTasksOlderThan(
        state,
        before,
        after,
        PAGE,
      );

      yield* page;

      const last = page[page.length - 1];

      if (!last || page.length < PAGE) {
        return;
      }

      after = { suspendedAt: last.suspendedAt, runId: last.runId };
    }
  }
}

export const TURNS_EVERY_MS = MINUTE_MS;
