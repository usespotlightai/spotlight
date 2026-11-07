export const ATTACHMENT_READER = Symbol('ATTACHMENT_READER');

export interface AttachmentSummary {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export type AttachmentHolder =
  | { readonly kind: 'task'; readonly taskId: string }
  | {
      readonly kind: 'chat';
      readonly startedById: string;
      readonly teamId: string;
    };

export interface AttachmentRecord extends AttachmentSummary {
  readonly workspaceId: string;
  readonly holder: AttachmentHolder;
}

export interface AttachmentReaderPort {
  find(id: string): Promise<AttachmentRecord | null>;
}
