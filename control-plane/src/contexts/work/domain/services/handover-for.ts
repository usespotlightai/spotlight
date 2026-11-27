import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { PassDenial } from '@work/domain/value-objects/line-denial';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { RunResult } from '@work/domain/value-objects/run-result.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

const bodyOf = (handover: Handover, fallback: string) =>
  TaskNoteBody.of(handover.note === '' ? fallback : handover.note);

const ownWords = (handover: Handover): TaskNoteBody | null =>
  handover.note === '' ? null : TaskNoteBody.of(handover.note);

const UNROUTED =
  'The run finished without saying where the task should go next.';

// Spotlight refused to start the run. Say so in plain words, then why, and that an answer starts it again.
const refusedNote = (
  station: StationName | null,
  because: string | null,
): TaskNoteBody => {
  const didNotStart = `${station?.value ?? 'The run'} didn’t start.`;
  const why = because?.trim() ?? '';

  return TaskNoteBody.of(
    why === ''
      ? `${didNotStart} Answer here to start it again.`
      : `${didNotStart} ${why} Then answer here to start it again.`,
  );
};

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
    outcome: RunResult;
    handover: Handover | null;
    line: LineMap | null;
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

    return HandoverFor.outcome(
      input.outcome,
      input.lastWords ?? null,
      input.line?.stationAt(input.currentStation)?.name ?? null,
    );
  },

  resolve(
    handover: Handover,
    line: LineMap | null,
    currentStation: StationId,
  ): ResolvedHandover {
    if (handover.requestsReview()) {
      const toAPerson = handover.asksAPersonItself()
        ? ResolvedHandover.asked
        : ResolvedHandover.review;

      return toAPerson(
        bodyOf(handover, 'The run asked for someone to look at this.'),
        ownWords(handover),
        handover.attachments,
        handover.suggestsClosing(),
      );
    }

    if (handover.isDone()) {
      return line?.endsAt(currentStation)
        ? ResolvedHandover.done(
            bodyOf(handover, 'The work is done.'),
            ownWords(handover),
            handover.attachments,
          )
        : ResolvedHandover.review(
            TaskNoteBody.of(
              'The run handed over the task as done. The task is not at the end of its line.',
            ),
            ownWords(handover),
            handover.attachments,
          );
    }

    const named = line?.stations.find((each) => handover.names(each.key));

    if (!line || !named) {
      return ResolvedHandover.review(
        TaskNoteBody.of(
          `The run requested station "${handover.next}". This line has no such station.`,
        ),
        ownWords(handover),
        handover.attachments,
      );
    }

    const denial = line.passDenial(currentStation, named);

    if (denial) {
      return ResolvedHandover.review(
        TaskNoteBody.of(DENIALS[denial](named.key.value)),
        ownWords(handover),
        handover.attachments,
      );
    }

    return ResolvedHandover.pass(
      named.id,
      bodyOf(handover, `Passed on to ${named.name.value}.`),
      handover.attachments,
    );
  },

  outcome(
    outcome: RunResult | null,
    lastWords: string | null = null,
    station: StationName | null = null,
  ): ResolvedHandover {
    if (!outcome) {
      const unreported = TaskNoteBody.of(
        'The run ended without reporting an outcome.',
      );

      return ResolvedHandover.review(unreported, unreported);
    }

    if (outcome.refused) {
      return ResolvedHandover.failed(
        refusedNote(station, outcome.message),
        TaskFailure.fromRun('refused'),
      );
    }

    if (outcome.failure) {
      return ResolvedHandover.failed(
        TaskNoteBody.of(
          nonEmpty(outcome.message)
            ? `The run failed: ${outcome.message}`
            : `The run failed. Exit code: ${outcome.exitCode}`,
        ),
        TaskFailure.fromRun(outcome.failure.code),
      );
    }

    if (lastWords !== null && lastWords.trim() !== '') {
      const said = TaskNoteBody.of(lastWords);

      return ResolvedHandover.review(
        TaskNoteBody.of(`${UNROUTED}\n\n${said.value}`),
        said,
      );
    }

    return ResolvedHandover.review(TaskNoteBody.of(UNROUTED));
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
