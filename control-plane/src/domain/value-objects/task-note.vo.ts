import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

export class TaskNote {
  private constructor(
    readonly station: StationName,
    readonly body: TaskNoteBody,
    readonly at: Date,
  ) {}

  static of(input: {
    station: StationName;
    body: TaskNoteBody;
    at: Date;
  }): TaskNote {
    return new TaskNote(input.station, input.body, input.at);
  }
}
