import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { HappeningPayload } from '@work/domain/value-objects/happening-payload';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import type {
  ReviewRequest,
  ReviewRequestReceived,
} from '@work/domain/value-objects/review-request.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';

interface OutcomeNote {
  readonly line: LineMap;
  readonly body: TaskNoteBody;
  readonly anchor: Anchor | null;
}

export type Outcome =
  | { readonly kind: 'nothing' }
  | (OutcomeNote & { readonly kind: 'stays' })
  | (OutcomeNote & {
      readonly kind: 'deferredMove';
      readonly to: Station;
      readonly closed: PullRequestUrl | null;
    })
  | (OutcomeNote & {
      readonly kind: 'held';
      readonly to: Station;
      readonly closed: PullRequestUrl;
    })
  | (OutcomeNote & { readonly kind: 'answers'; readonly to: NotePosition })
  | (OutcomeNote & {
      readonly kind: 'moves';
      readonly to: Station;
      readonly closed: PullRequestUrl | null;
    });

export interface Opening {
  readonly at: Station;
  readonly title: TaskTitle;
  readonly description: TaskDescription | null;
  readonly marks: readonly Mark[];
}

export interface OpenedOn {
  readonly line: LineMap;
  readonly opening: Opening;
}

export type ReviewAnswer =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'received'; readonly by: Task }
  | { readonly kind: 'opens'; readonly on: OpenedOn };

const spotlights = (
  request: ReviewRequest,
  branchTask: Task | null,
  pullRequestTask: Task | null,
): boolean =>
  (request.branch?.isSpotlights ?? false) ||
  branchTask !== null ||
  (pullRequestTask !== null && !pullRequestTask.reviewing);

export const movedTo = (outcome: Outcome): StationId | null =>
  outcome.kind === 'moves' ? outcome.to.id : null;

export const ReactionFor = {
  happened(input: {
    task: Task;
    line: LineMap;
    payload: HappeningPayload;
    anchor: Anchor | null;
  }): Outcome {
    if (input.line.completed.id.equals(input.task.stationId)) {
      return { kind: 'nothing' };
    }

    const rule = input.line.reactionTo(
      input.payload.happening,
      input.task.stationId,
    );
    const here = input.line.stationAt(input.task.stationId);

    const note = (
      body = TaskNoteBody.receivedHappening(
        input.payload.summary,
        input.anchor,
      ),
    ): OutcomeNote => ({ line: input.line, body, anchor: input.anchor });

    const closed = input.payload.closedPullRequest ?? null;

    if (rule && closed && input.task.routedCloseOf(closed)) {
      return { kind: 'stays', ...note() };
    }

    if (rule) {
      const destination = input.line.stationAt(rule.to);

      if (!destination) {
        return { kind: 'nothing' };
      }

      if (closed && input.task.keepsUnsettledPullRequestBeside(closed)) {
        return destination.id.equals(input.task.stationId)
          ? { kind: 'stays', ...note() }
          : {
              kind: 'held',
              to: destination,
              closed,
              ...note(
                TaskNoteBody.heldMove(
                  destination.name,
                  TaskNoteBody.receivedHappening(
                    input.payload.summary,
                    input.anchor,
                  ),
                ),
              ),
            };
      }

      if (!destination.id.equals(input.task.stationId)) {
        return ReactionFor.movingTo(input.task, destination, note(), closed);
      }
    }

    const pending = input.task.pendingConversation;
    if (here && pending && input.payload.answers && input.anchor) {
      return {
        kind: 'answers',
        to: pending.from,
        ...note(),
      };
    }

    return rule && here && !(input.payload.answers && !input.anchor)
      ? { kind: 'stays', ...note() }
      : { kind: 'nothing' };
  },

  movingTo(
    task: Task,
    to: Station,
    note: OutcomeNote,
    closed: PullRequestUrl | null,
  ): Outcome {
    return task.movableByHappeningTo(note.line, to.id)
      ? { kind: 'moves', to, closed, ...note }
      : { kind: 'deferredMove', to, closed, ...note };
  },

  openingOn(input: {
    lines: readonly LineMap[];
    opens: OpensWith;
  }): OpenedOn | null {
    const ordered = [...input.lines].sort((one, other) =>
      one.key.compare(other.key),
    );

    for (const line of ordered) {
      const opening = ReactionFor.opening({ line, opens: input.opens });

      if (opening) {
        return { line, opening };
      }
    }

    return null;
  },

  // pullRequestTask has the mark of the pull request. reviewTask has the mark of a review of the pull request.
  reviewRequested(input: {
    lines: readonly LineMap[];
    opens: OpensWith;
    request: ReviewRequest;
    anchor: Anchor | null;
    branchTask: Task | null;
    pullRequestTask: Task | null;
    reviewTask: Task | null;
  }): ReviewAnswer {
    const on = ReactionFor.reviewOn({
      lines: input.lines,
      opens: input.opens,
      request: {
        ...input.request.parts,
        anchor: input.anchor,
        ours: spotlights(
          input.request,
          input.branchTask,
          input.pullRequestTask,
        ),
      },
    });

    if (!on) {
      return { kind: 'nothing' };
    }

    return input.reviewTask && input.reviewTask.finishedAt === null
      ? { kind: 'received', by: input.reviewTask }
      : { kind: 'opens', on };
  },

  reviewOn(input: {
    lines: readonly LineMap[];
    opens: OpensWith;
    request: ReviewRequestReceived;
  }): OpenedOn | null {
    const repository = input.request.pullRequest.repository;
    const named = (line: LineMap): number =>
      repository && line.names(repository) ? 0 : 1;
    const ordered = input.lines
      .filter((line) => line.takesReview(input.request))
      .sort(
        (one, other) => named(one) - named(other) || one.key.compare(other.key),
      );

    for (const line of ordered) {
      const opening = ReactionFor.opening({ line, opens: input.opens });

      if (opening) {
        return { line, opening };
      }
    }

    return null;
  },

  opening(input: { line: LineMap; opens: OpensWith }): Opening | null {
    if (!input.line.role?.equals(input.opens.lineRole)) {
      return null;
    }

    const at = input.opens.station
      ? (input.line.stationKeyed(input.opens.station) ?? input.line.entry)
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
