import type { RunOutcome } from '@domain/aggregates/run.aggregate';
import { Handover } from '@domain/value-objects/handover.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

export const HandoverFor = {
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
