import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { Word } from '@domain/value-objects/happening.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

interface Told {
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly said: Said | null;
}

/** What word from outside does to a task. Nothing is the ordinary answer. */
export type Outcome =
  | { readonly kind: 'nothing' }
  | (Told & { readonly kind: 'stays' })
  | (Told & { readonly kind: 'answers'; readonly to: NotePosition })
  | (Told & { readonly kind: 'moves'; readonly to: Station });

export const ReactionFor = {
  happened(input: {
    task: Task;
    line: AssemblyLine;
    /** What the source says happened, in its own words. */
    word: Word;
    said: Said | null;
  }): Outcome {
    // The end of the line, not merely finished: a finished task's pull
    // request is still out there being read.
    if (input.line.completed.id.equals(input.task.stationId)) {
      return { kind: 'nothing' };
    }

    const rule = input.line.reactionTo(
      input.word.happening,
      input.task.stationId,
    );

    // A review with nothing written on it says nothing: its comments arrive
    // on their own, carrying what was actually said.
    if (!rule || (input.word.spoken && !input.said)) {
      return { kind: 'nothing' };
    }

    const waiting = input.line.stationAt(rule.to);

    // The line guards that a rule lands on it, so this is only ever a line
    // read in pieces. Nothing here guesses where the task should go instead.
    if (!waiting) {
      return { kind: 'nothing' };
    }

    const told = {
      station: input.line.stationAt(input.task.stationId)?.name ?? waiting.name,
      body: TaskNoteBody.heard(input.word.told, input.said),
      said: input.said,
    };

    if (!waiting.id.equals(input.task.stationId)) {
      return { kind: 'moves', to: waiting, ...told };
    }

    // Replied on the pull request rather than in the inbox, but it is still
    // the answer the station was waiting for.
    const owed = input.task.owedConversation;

    return owed && input.word.spoken
      ? { kind: 'answers', to: NotePosition.of(owed.from), ...told }
      : { kind: 'stays', ...told };
  },
};
