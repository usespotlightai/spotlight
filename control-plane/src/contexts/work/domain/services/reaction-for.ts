import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { Word } from '@work/domain/value-objects/happening.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import type {
  ReviewAsked,
  ReviewRequest,
} from '@work/domain/value-objects/review-asked.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
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
  | (Told & { readonly kind: 'heldBack'; readonly to: Station })
  | (Told & { readonly kind: 'interrupts' })
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

export type ReviewAnswer =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'heard'; readonly by: Task }
  | { readonly kind: 'opens'; readonly on: OpenedOn };

const spotlights = (request: ReviewRequest, holder: Task | null): boolean =>
  (request.branch?.isSpotlights ?? false) ||
  (holder !== null && !holder.reviewing);

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

    const note = (
      station: StationName,
      body = TaskNoteBody.heard(input.word.told, input.said),
    ): Told => ({ station, body, said: input.said });

    if (rule) {
      const destination = input.line.stationAt(rule.to);

      if (!destination) {
        return { kind: 'nothing' };
      }

      if (!destination.id.equals(input.task.stationId)) {
        const station = here?.name ?? StationName.unknown();

        if (!input.task.running) {
          return { kind: 'moves', to: destination, ...note(station) };
        }

        return input.line.completed.id.equals(destination.id)
          ? {
              kind: 'interrupts',
              ...note(
                station,
                input.task.awaitsAnAnswer
                  ? TaskNoteBody.interruptedWhileWaiting(
                      input.word.told,
                      here?.name ?? null,
                    )
                  : TaskNoteBody.interrupted(
                      input.word.told,
                      here?.name ?? null,
                    ),
              ),
            }
          : {
              kind: 'heldBack',
              to: destination,
              ...note(
                station,
                TaskNoteBody.heldBack(
                  input.word.told,
                  input.said,
                  destination.name,
                ),
              ),
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

  // holder wears the pull request's own mark; held wears the mark of a review of it.
  reviewAsked(input: {
    lines: readonly Line[];
    opens: OpensWith;
    request: ReviewRequest;
    said: Said | null;
    holder: Task | null;
    held: Task | null;
  }): ReviewAnswer {
    const on = ReactionFor.reviewOn({
      lines: input.lines,
      opens: input.opens,
      asked: {
        ...input.request,
        said: input.said,
        ours: spotlights(input.request, input.holder),
      },
    });

    if (!on) {
      return { kind: 'nothing' };
    }

    return input.held && input.held.finishedAt === null
      ? { kind: 'heard', by: input.held }
      : { kind: 'opens', on };
  },

  reviewOn(input: {
    lines: readonly Line[];
    opens: OpensWith;
    asked: ReviewAsked;
  }): OpenedOn | null {
    const repository = input.asked.pullRequest.repository;
    const named = (line: Line): number =>
      repository && line.names(repository) ? 0 : 1;
    const ordered = input.lines
      .filter((line) => line.takesReview(input.asked))
      .sort(
        (one, other) =>
          named(one) - named(other) ||
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
      ? (input.line.stationKeyed(input.opens.at) ?? input.line.entry)
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
