import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

interface HandoverNote {
  readonly body: TaskNoteBody;
  readonly account: TaskNoteBody | null;
}

export type ResolvedHandover =
  | (HandoverNote & {
      readonly kind: 'review';
      readonly failure: TaskFailure | null;
    })
  | (HandoverNote & { readonly kind: 'done' })
  | (HandoverNote & { readonly kind: 'pass'; readonly stationId: StationId });

export const ResolvedHandover = {
  review: (
    body: TaskNoteBody,
    account: TaskNoteBody | null = null,
  ): ResolvedHandover => ({
    kind: 'review',
    body,
    account,
    failure: null,
  }),

  failed: (body: TaskNoteBody, failure: TaskFailure): ResolvedHandover => ({
    kind: 'review',
    body,
    account: body,
    failure,
  }),

  done: (
    body: TaskNoteBody,
    account: TaskNoteBody | null = null,
  ): ResolvedHandover => ({
    kind: 'done',
    body,
    account,
  }),

  pass: (stationId: StationId, body: TaskNoteBody): ResolvedHandover => ({
    kind: 'pass',
    stationId,
    body,
    account: body,
  }),
};
