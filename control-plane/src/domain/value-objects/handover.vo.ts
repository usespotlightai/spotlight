import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

export class Handover {
  private constructor(
    readonly kind: 'review' | 'pass',
    readonly body: TaskNoteBody,
    readonly stationId: StationId | null,
  ) {}

  static review(body: TaskNoteBody): Handover {
    return new Handover('review', body, null);
  }

  static pass(stationId: StationId, body: TaskNoteBody): Handover {
    return new Handover('pass', body, stationId);
  }
}
