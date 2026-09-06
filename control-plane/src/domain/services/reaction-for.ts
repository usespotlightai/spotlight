import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { Word } from '@domain/value-objects/happening.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { Mark } from '@domain/value-objects/mark.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';

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

/** A task to open where a word concerns none: where, what to call it, and the handles it wears. */
export interface Opening {
  readonly at: Station;
  readonly title: TaskTitle;
  readonly description: TaskDescription | null;
  readonly marks: readonly Mark[];
}

export interface OpenedOn {
  readonly line: AssemblyLine;
  readonly opening: Opening;
}

/** What a source read off a delivery for a task the word opens. */
export interface OpensWith {
  /** The role of the lines it opens a task on. */
  readonly onto: LineRole;
  readonly title: string;
  readonly description: string | null;
}

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

  /**
   * The one line a word opens a task on: the first, by key, whose role it
   * opens onto. However many lines share the role, the word names one task —
   * the same handle cannot wear two — so the choice is settled here rather
   * than left to ride on the order the lines came back in.
   */
  openingOn(input: {
    lines: readonly AssemblyLine[];
    concerns: Concerns;
    opens: OpensWith;
  }): OpenedOn | null {
    const ordered = [...input.lines].sort((one, other) =>
      one.key.value.localeCompare(other.key.value),
    );

    for (const line of ordered) {
      const opening = ReactionFor.opening({
        line,
        concerns: input.concerns,
        opens: input.opens,
      });

      if (opening) {
        return { line, opening };
      }
    }

    return null;
  },

  /** A task to open on a line the word opens onto. A word its role does not
   *  match, or with no handle to find it by, opens nothing. */
  opening(input: {
    line: AssemblyLine;
    concerns: Concerns;
    opens: OpensWith;
  }): Opening | null {
    if (!input.line.role?.equals(input.opens.onto)) {
      return null;
    }

    const at = input.line.entry;

    if (!at) {
      return null;
    }

    const [named] = input.concerns.marks;

    if (!named) {
      return null;
    }

    // What the source read off the delivery names the task; the handle it is
    // marked by is only the fallback, so a task is never left named by an id.
    return {
      at,
      title: TaskTitle.clamp(input.opens.title || named.value),
      description: input.opens.description
        ? TaskDescription.clamp(input.opens.description)
        : null,
      marks: input.concerns.marks,
    };
  },
};
