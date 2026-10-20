import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { PassDenial } from '@work/domain/value-objects/line-denial';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

const bodyOf = (handover: Handover, fallback: string) =>
  TaskNoteBody.of(handover.note === '' ? fallback : handover.note);

const ownWords = (handover: Handover): TaskNoteBody | null =>
  handover.note === '' ? null : TaskNoteBody.of(handover.note);

const DENIALS: Record<PassDenial, (key: string) => string> = {
  'already-there': (key) =>
    `The run requested station "${key}". The task is already there.`,
  'nothing-runs': (key) =>
    `The run requested station "${key}". Nothing runs there to take up the task.`,
  'no-route': (key) =>
    `The run requested station "${key}". Work does not pass there from the task’s station.`,
};

export const HandoverFor = {
  after(input: {
    outcome: RunOutcome;
    handover: Handover | null;
    line: Line | null;
    currentStation: StationId;
    lastWords?: string | null;
  }): ResolvedHandover {
    if (input.outcome.stopped) {
      return HandoverFor.stopped();
    }

    if (input.handover && !input.outcome.failed) {
      return HandoverFor.resolve(
        input.handover,
        input.line,
        input.currentStation,
      );
    }

    return HandoverFor.outcome(input.outcome, input.lastWords ?? null);
  },

  resolve(
    handover: Handover,
    line: Line | null,
    currentStation: StationId,
  ): ResolvedHandover {
    if (handover.requestsReview()) {
      return ResolvedHandover.review(
        bodyOf(handover, 'The run asked for someone to look at this.'),
        ownWords(handover),
      );
    }

    if (handover.isDone()) {
      return line?.endsAt(currentStation)
        ? ResolvedHandover.done(
            bodyOf(handover, 'The work is done.'),
            ownWords(handover),
          )
        : ResolvedHandover.review(
            TaskNoteBody.of(
              'The run handed over the task as done. The task is not at the end of its line.',
            ),
            ownWords(handover),
          );
    }

    const named = line?.stations.find((each) => handover.names(each.key));

    if (!line || !named) {
      return ResolvedHandover.review(
        TaskNoteBody.of(
          `The run requested station "${handover.next}". This line has no such station.`,
        ),
        ownWords(handover),
      );
    }

    const denial = line.passDenial(currentStation, named);

    if (denial) {
      return ResolvedHandover.review(
        TaskNoteBody.of(DENIALS[denial](named.key.value)),
        ownWords(handover),
      );
    }

    return ResolvedHandover.pass(
      named.id,
      bodyOf(handover, `Passed on to ${named.name.value}.`),
    );
  },

  outcome(
    outcome: RunOutcome | null,
    lastWords: string | null = null,
  ): ResolvedHandover {
    if (!outcome) {
      const unreported = TaskNoteBody.of(
        'The run ended without reporting an outcome.',
      );

      return ResolvedHandover.review(unreported, unreported);
    }

    if (outcome.failure) {
      return ResolvedHandover.failed(
        TaskNoteBody.of(
          outcome.message
            ? `The run failed: ${outcome.message}`
            : `The run failed. Exit code: ${outcome.exitCode}`,
        ),
        TaskFailure.fromRun(outcome.failure.code),
      );
    }

    if (lastWords?.trim()) {
      const said = TaskNoteBody.of(lastWords);

      return ResolvedHandover.review(said, said);
    }

    return ResolvedHandover.review(
      TaskNoteBody.of(
        'The run finished without saying where the task should go next.',
      ),
    );
  },

  exhausted(attempts: number, failure: RunFailureCode): ResolvedHandover {
    return ResolvedHandover.failed(
      TaskNoteBody.of(
        `The run did not finish after ${attempts} attempts. Spotlight does not try it again.`,
      ),
      TaskFailure.fromRun(failure),
    );
  },

  stopped(): ResolvedHandover {
    return ResolvedHandover.review(
      TaskNoteBody.of('A person stopped the run. The task is back with you.'),
      TaskNoteBody.of('A person stopped the run.'),
    );
  },
};
