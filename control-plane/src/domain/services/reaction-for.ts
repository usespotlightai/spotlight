import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';
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
  /** Which station along that line, by key; null for the line's entry. */
  readonly at: string | null;
  readonly title: string;
  readonly description: string | null;
  /** The email to assign the task by, where the delivery named one; else null. */
  readonly assignEmail: string | null;
  /** Every mark the opened task wears: the handles it is found by, and any
   *  ambient context it carries, such as where the word came from. */
  readonly marks: readonly Mark[];
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
    const here = input.line.stationAt(input.task.stationId);

    const note = (station: StationName): Told => ({
      station,
      body: TaskNoteBody.heard(input.word.told, input.said),
      said: input.said,
    });

    // A rule that lands the work on another station routes it there, and that
    // wins over answering in place.
    if (rule) {
      const destination = input.line.stationAt(rule.to);

      if (!destination) {
        return { kind: 'nothing' };
      }

      if (!destination.id.equals(input.task.stationId)) {
        return {
          kind: 'moves',
          to: destination,
          ...note(here?.name ?? destination.name),
        };
      }
    }

    // A spoken word the task was waiting on answers it in place, needing no
    // rule: the owed conversation already says where the answer belongs.
    const owed = input.task.owedConversation;
    if (here && owed && input.word.spoken && input.said) {
      return {
        kind: 'answers',
        to: NotePosition.of(owed.from),
        ...note(here.name),
      };
    }

    return rule && here && !(input.word.spoken && !input.said)
      ? { kind: 'stays', ...note(here.name) }
      : { kind: 'nothing' };
  },

  /**
   * The one line a word opens a task on: the first, by key, whose role it
   * opens onto. However many lines share the role, the word names one task —
   * the same handle cannot wear two — so the choice is settled here rather
   * than left to ride on the order the lines came back in.
   */
  openingOn(input: {
    lines: readonly AssemblyLine[];
    opens: OpensWith;
  }): OpenedOn | null {
    const ordered = [...input.lines].sort((one, other) =>
      one.key.value.localeCompare(other.key.value),
    );

    for (const line of ordered) {
      const opening = ReactionFor.opening({ line, opens: input.opens });

      if (opening) {
        return { line, opening };
      }
    }

    return null;
  },

  /** A task to open on a line the word opens onto. A word its role does not
   *  match, or with no mark to wear, opens nothing. */
  opening(input: { line: AssemblyLine; opens: OpensWith }): Opening | null {
    if (!input.line.role?.equals(input.opens.onto)) {
      return null;
    }

    // A named station lands the task there; otherwise it enters at the front.
    const at = input.opens.at
      ? (input.line.stations.find(
          (station) => station.key.value === input.opens.at,
        ) ?? input.line.entry)
      : input.line.entry;

    if (!at) {
      return null;
    }

    const [first] = input.opens.marks;

    if (!first) {
      return null;
    }

    // What the source read off the delivery names the task; the first mark it
    // wears is only the fallback, so a task is never left named by an id.
    return {
      at,
      title: TaskTitle.clamp(input.opens.title || first.value),
      description: input.opens.description
        ? TaskDescription.clamp(input.opens.description)
        : null,
      marks: input.opens.marks,
    };
  },
};
