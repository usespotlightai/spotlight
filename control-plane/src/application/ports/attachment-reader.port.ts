export const ATTACHMENT_READER = Symbol('ATTACHMENT_READER');

export interface AttachmentSummary {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface HeldAttachment extends AttachmentSummary {
  readonly workspaceId: string;
  readonly taskId: string;
}

export interface AttachmentReaderPort {
  find(id: string): Promise<HeldAttachment | null>;
}
