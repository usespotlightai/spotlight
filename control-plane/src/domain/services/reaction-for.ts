import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import {
  type Happening,
  spokenByAPerson,
} from '@domain/value-objects/happening.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

interface Told {
  readonly station: StationName;
  readonly body: TaskNoteBody;
}

/** What word from outside does to a task. Nothing is the ordinary answer. */
export type Reaction =
  | { readonly kind: 'nothing' }
  | (Told & { readonly kind: 'stays' })
  | (Told & { readonly kind: 'answers'; readonly to: NotePosition })
  | (Told & { readonly kind: 'moves'; readonly to: Station });

export const ReactionFor = {
  happened(input: {
    task: Task;
    line: AssemblyLine;
    happening: Happening;
    said: Said | null;
  }): Reaction {
    // The end of the line, not merely finished: a finished task's pull
    // request is still out there being read.
    if (input.line.completed.id.equals(input.task.stationId)) {
      return { kind: 'nothing' };
    }

    const waiting = input.line.reactionTo(input.happening);

    // A review with nothing written on it says nothing: its comments arrive
    // on their own, carrying what was actually said.
    if (!waiting || (spokenByAPerson(input.happening) && !input.said)) {
      return { kind: 'nothing' };
    }

    const told = {
      station: input.line.stationAt(input.task.stationId)?.name ?? waiting.name,
      body: TaskNoteBody.heard(input.happening, input.said),
    };

    if (!waiting.id.equals(input.task.stationId)) {
      return { kind: 'moves', to: waiting, ...told };
    }

    // Replied on the pull request rather than in the inbox, but it is still
    // the answer the station was waiting for.
    const owed = input.task.owedConversation;

    return owed && spokenByAPerson(input.happening)
      ? { kind: 'answers', to: NotePosition.of(owed.from), ...told }
      : { kind: 'stays', ...told };
  },
};
