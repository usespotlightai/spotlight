import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

interface Said {
  readonly body: TaskNoteBody;
}

export type Handover =
  | (Said & { readonly kind: 'review' })
  | (Said & { readonly kind: 'done' })
  | (Said & { readonly kind: 'pass'; readonly stationId: StationId });

export const Handover = {
  review: (body: TaskNoteBody): Handover => ({ kind: 'review', body }),

  done: (body: TaskNoteBody): Handover => ({ kind: 'done', body }),

  pass: (stationId: StationId, body: TaskNoteBody): Handover => ({
    kind: 'pass',
    stationId,
    body,
  }),
};
