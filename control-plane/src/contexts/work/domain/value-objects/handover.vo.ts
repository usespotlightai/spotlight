import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

interface Said {
  readonly body: TaskNoteBody;
}

export type Handover =
  | (Said & { readonly kind: 'review'; readonly failure: TaskFailure | null })
  | (Said & { readonly kind: 'done' })
  | (Said & { readonly kind: 'pass'; readonly stationId: StationId });

export const Handover = {
  review: (body: TaskNoteBody): Handover => ({
    kind: 'review',
    body,
    failure: null,
  }),

  failed: (body: TaskNoteBody, failure: TaskFailure): Handover => ({
    kind: 'review',
    body,
    failure,
  }),

  done: (body: TaskNoteBody): Handover => ({ kind: 'done', body }),

  pass: (stationId: StationId, body: TaskNoteBody): Handover => ({
    kind: 'pass',
    stationId,
    body,
  }),
};
