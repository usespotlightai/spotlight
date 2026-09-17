import type { Line, PassRefusal } from '@work/domain/aggregates/line.aggregate';
import type { Declaration } from '@work/domain/value-objects/declaration.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

const spoken = (declaration: Declaration, fallback: string) =>
  TaskNoteBody.of(declaration.note === '' ? fallback : declaration.note);

const REFUSED: Record<PassRefusal, (key: string) => string> = {
  'standing-there': (key) =>
    `The run asked for "${key}", where the task already stands.`,
  'nothing-runs': (key) =>
    `The run asked for "${key}", where nothing runs to take the task up.`,
  'no-way': (key) =>
    `The run asked for "${key}", which work does not pass to from where the task stands.`,
};

export const HandoverFor = {
  after(input: {
    outcome: RunOutcome;
    declared: Declaration | null;
    line: Line | null;
    standingAt: StationId;
  }): Handover {
    if (input.outcome.stopped) {
      return HandoverFor.stopped();
    }

    if (input.declared && !input.outcome.failed) {
      return HandoverFor.declared(input.declared, input.line, input.standingAt);
    }

    return HandoverFor.outcome(input.outcome);
  },

  declared(
    declaration: Declaration,
    line: Line | null,
    standingAt: StationId,
  ): Handover {
    if (declaration.asksForReview()) {
      return Handover.review(
        spoken(declaration, 'The run asked for someone to look at this.'),
      );
    }

    if (declaration.saysItIsDone()) {
      return line?.endsAt(standingAt)
        ? Handover.done(spoken(declaration, 'The work is done.'))
        : Handover.review(
            TaskNoteBody.of(
              'The run said the work is done, and the line does not end where the task stands.',
            ),
          );
    }

    const named = line?.stations.find((each) => declaration.names(each.key));

    if (!line || !named) {
      return Handover.review(
        TaskNoteBody.of(
          `The run asked for "${declaration.next}", which is not a station on this line.`,
        ),
      );
    }

    const refused = line.refusalToPass(standingAt, named);

    if (refused) {
      return Handover.review(
        TaskNoteBody.of(REFUSED[refused](named.key.value)),
      );
    }

    return Handover.pass(
      named.id,
      spoken(declaration, `Passed on to ${named.name.value}.`),
    );
  },

  outcome(outcome: RunOutcome | null): Handover {
    if (!outcome) {
      return Handover.review(
        TaskNoteBody.of('The run ended without reporting an outcome.'),
      );
    }

    if (outcome.failed) {
      return Handover.review(
        TaskNoteBody.of(
          `The run failed: ${outcome.message ?? `exit ${outcome.exitCode}`}`,
        ),
      );
    }

    return Handover.review(
      TaskNoteBody.of(
        'The run finished without saying where the task should go next.',
      ),
    );
  },

  exhausted(attempts: number): Handover {
    return Handover.review(
      TaskNoteBody.of(
        `The run was given up on after ${attempts} attempts without finishing.`,
      ),
    );
  },

  stopped(): Handover {
    return Handover.review(
      TaskNoteBody.of('Stopped from the console. It is back with you.'),
    );
  },
};
