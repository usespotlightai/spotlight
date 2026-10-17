import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Declaration } from '@work/domain/value-objects/declaration.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import type { PassDenial } from '@work/domain/value-objects/line-denial';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

const spoken = (declaration: Declaration, fallback: string) =>
  TaskNoteBody.of(declaration.note === '' ? fallback : declaration.note);

const ownWords = (declaration: Declaration): TaskNoteBody | null =>
  declaration.note === '' ? null : TaskNoteBody.of(declaration.note);

const DENIALS: Record<PassDenial, (key: string) => string> = {
  'already-there': (key) =>
    `The run asked for station "${key}". The task is already there.`,
  'nothing-runs': (key) =>
    `The run asked for station "${key}". Nothing runs there to take up the task.`,
  'no-way': (key) =>
    `The run asked for station "${key}". Work does not pass there from the task’s station.`,
};

export const HandoverFor = {
  after(input: {
    outcome: RunOutcome;
    declared: Declaration | null;
    line: Line | null;
    currentStation: StationId;
  }): Handover {
    if (input.outcome.stopped) {
      return HandoverFor.stopped();
    }

    if (input.declared && !input.outcome.failed) {
      return HandoverFor.declared(
        input.declared,
        input.line,
        input.currentStation,
      );
    }

    return HandoverFor.outcome(input.outcome);
  },

  declared(
    declaration: Declaration,
    line: Line | null,
    currentStation: StationId,
  ): Handover {
    if (declaration.asksForReview()) {
      return Handover.review(
        spoken(declaration, 'The run asked for someone to look at this.'),
        ownWords(declaration),
      );
    }

    if (declaration.saysItIsDone()) {
      return line?.endsAt(currentStation)
        ? Handover.done(
            spoken(declaration, 'The work is done.'),
            ownWords(declaration),
          )
        : Handover.review(
            TaskNoteBody.of(
              'The run said the work is done. The task is not at the end of its line.',
            ),
            ownWords(declaration),
          );
    }

    const named = line?.stations.find((each) => declaration.names(each.key));

    if (!line || !named) {
      return Handover.review(
        TaskNoteBody.of(
          `The run asked for station "${declaration.next}". This line has no such station.`,
        ),
        ownWords(declaration),
      );
    }

    const denial = line.passDenial(currentStation, named);

    if (denial) {
      return Handover.review(
        TaskNoteBody.of(DENIALS[denial](named.key.value)),
        ownWords(declaration),
      );
    }

    return Handover.pass(
      named.id,
      spoken(declaration, `Passed on to ${named.name.value}.`),
    );
  },

  outcome(outcome: RunOutcome | null): Handover {
    if (!outcome) {
      const unreported = TaskNoteBody.of(
        'The run ended without reporting an outcome.',
      );

      return Handover.review(unreported, unreported);
    }

    if (outcome.failure) {
      return Handover.failed(
        TaskNoteBody.of(
          outcome.message
            ? `The run failed: ${outcome.message}`
            : `The run failed. Exit code: ${outcome.exitCode}`,
        ),
        TaskFailure.fromRun(outcome.failure.code),
      );
    }

    return Handover.review(
      TaskNoteBody.of(
        'The run finished without saying where the task should go next.',
      ),
    );
  },

  exhausted(attempts: number, failure: RunFailureCode): Handover {
    return Handover.failed(
      TaskNoteBody.of(
        `The run did not finish after ${attempts} attempts. Spotlight does not try it again.`,
      ),
      TaskFailure.fromRun(failure),
    );
  },

  stopped(): Handover {
    return Handover.review(
      TaskNoteBody.of('A person stopped the run. The task is back with you.'),
      TaskNoteBody.of('A person stopped the run.'),
    );
  },
};
