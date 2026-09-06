import type { Station } from '@domain/entities/station.entity';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import { Handover } from '@domain/value-objects/handover.vo';
import type { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

const spoken = (declaration: Declaration, fallback: string) =>
  TaskNoteBody.of(declaration.note === '' ? fallback : declaration.note);

export const HandoverFor = {
  declared(
    declaration: Declaration,
    stations: readonly Station[],
    standingAt?: StationId,
  ): Handover {
    if (declaration.saysItIsDone()) {
      return Handover.done(spoken(declaration, 'The work is done.'));
    }

    if (declaration.asksForReview()) {
      return Handover.review(
        spoken(declaration, 'The run asked for someone to look at this.'),
      );
    }

    const named = stations.find((each) => declaration.names(each.name));

    if (!named) {
      return Handover.review(
        TaskNoteBody.of(
          `The run asked for "${declaration.next}", which is not a station on this line.`,
        ),
      );
    }

    // Handing a task back to where it already stands moves nothing and
    // starts the same work again. The run had its turn and decided nothing,
    // so a person decides instead.
    if (standingAt && named.id.equals(standingAt)) {
      return Handover.review(
        TaskNoteBody.of(
          `The run asked for "${named.name.value}", where the task already stands.`,
        ),
      );
    }

    if (!named.harness) {
      return Handover.review(
        TaskNoteBody.of(
          `The run asked for "${named.name.value}", where nothing runs to take the task up.`,
        ),
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
};
