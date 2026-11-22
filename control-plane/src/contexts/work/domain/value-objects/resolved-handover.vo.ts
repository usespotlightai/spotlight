import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

interface HandoverNote {
  readonly body: TaskNoteBody;
  readonly account: TaskNoteBody | null;
  readonly attachments: readonly Attachment[];
}

export type ResolvedHandover =
  | (HandoverNote & {
      readonly kind: 'review';
      readonly failure: TaskFailure | null;
      readonly suggestsClosing: boolean;
      readonly asked: boolean;
    })
  | (HandoverNote & { readonly kind: 'done' })
  | (HandoverNote & { readonly kind: 'pass'; readonly stationId: StationId });

export const ResolvedHandover = {
  suggestsClosing: (handover: ResolvedHandover): boolean =>
    handover.kind === 'review' && handover.suggestsClosing,

  review: (
    body: TaskNoteBody,
    account: TaskNoteBody | null = null,
    attachments: readonly Attachment[] = [],
    suggestsClosing = false,
  ): ResolvedHandover => ({
    kind: 'review',
    body,
    account,
    attachments,
    failure: null,
    suggestsClosing,
    asked: false,
  }),

  asked: (
    body: TaskNoteBody,
    account: TaskNoteBody | null,
    attachments: readonly Attachment[],
    suggestsClosing: boolean,
  ): ResolvedHandover => ({
    kind: 'review',
    body,
    account,
    attachments,
    failure: null,
    suggestsClosing,
    asked: true,
  }),

  failed: (body: TaskNoteBody, failure: TaskFailure): ResolvedHandover => ({
    kind: 'review',
    body,
    account: body,
    attachments: [],
    failure,
    suggestsClosing: false,
    asked: false,
  }),

  done: (
    body: TaskNoteBody,
    account: TaskNoteBody | null = null,
    attachments: readonly Attachment[] = [],
  ): ResolvedHandover => ({
    kind: 'done',
    body,
    account,
    attachments,
  }),

  pass: (
    stationId: StationId,
    body: TaskNoteBody,
    attachments: readonly Attachment[] = [],
  ): ResolvedHandover => ({
    kind: 'pass',
    stationId,
    body,
    account: body,
    attachments,
  }),
};
