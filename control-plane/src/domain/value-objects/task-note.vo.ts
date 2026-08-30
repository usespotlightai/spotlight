import type { RunId } from '@domain/value-objects/run-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** What a note did: put the task to a person, moved it on, or answered. */
export type TaskNoteKind = 'asked' | 'passed' | 'answered';

export class TaskNote {
  private constructor(
    readonly station: StationName,
    readonly body: TaskNoteBody,
    readonly at: Date,
    // Who said it. Absent is the station speaking, which is what every note
    // was until a person could answer one.
    readonly author: UserId | null,
    // The run whose ending wrote it, where one did. What the agent did to
    // arrive at it is that run's journal.
    readonly run: RunId | null,
    // An 'asked' opens a stretch a person owns; a 'passed' closes it.
    readonly kind: TaskNoteKind,
  ) {}

  static of(input: {
    station: StationName;
    body: TaskNoteBody;
    at: Date;
    author?: UserId | null;
    run?: RunId | null;
    kind?: TaskNoteKind;
  }): TaskNote {
    return new TaskNote(
      input.station,
      input.body,
      input.at,
      input.author ?? null,
      input.run ?? null,
      input.kind ?? 'passed',
    );
  }
}
