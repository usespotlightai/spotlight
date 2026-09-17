import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { Word } from '@work/domain/value-objects/happening.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import type { Said } from '@work/domain/value-objects/said.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';

interface Told {
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly said: Said | null;
}

export type Outcome =
  | { readonly kind: 'nothing' }
  | (Told & { readonly kind: 'stays' })
  | (Told & { readonly kind: 'answers'; readonly to: NotePosition })
  | (Told & { readonly kind: 'moves'; readonly to: Station });

export interface Opening {
  readonly at: Station;
  readonly title: TaskTitle;
  readonly description: TaskDescription | null;
  readonly marks: readonly Mark[];
}

export interface OpenedOn {
  readonly line: Line;
  readonly opening: Opening;
}

export const ReactionFor = {
  happened(input: {
    task: Task;
    line: Line;
    word: Word;
    said: Said | null;
  }): Outcome {
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

  openingOn(input: {
    lines: readonly Line[];
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

  opening(input: { line: Line; opens: OpensWith }): Opening | null {
    if (!input.line.role?.equals(input.opens.onto)) {
      return null;
    }

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
