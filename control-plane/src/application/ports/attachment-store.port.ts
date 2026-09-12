import type { Attachment } from '@domain/value-objects/attachment.vo';
import type { AttachmentId } from '@domain/value-objects/attachment-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const ATTACHMENT_STORE = Symbol('ATTACHMENT_STORE');

export type Wanted = 'shown' | 'saved';

export interface UploadGrant {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface AttachmentContent {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface AttachmentStorePort {
  grant(
    workspaceId: WorkspaceId,
    uploader: UserId,
    file: Attachment,
  ): Promise<UploadGrant>;

  received(
    workspaceId: WorkspaceId,
    ids: readonly AttachmentId[],
  ): Promise<Attachment[]>;

  keep(
    workspaceId: WorkspaceId,
    file: Attachment,
    bytes: Uint8Array,
  ): Promise<void>;

  link(
    workspaceId: WorkspaceId,
    file: Attachment,
    wanted: Wanted,
  ): Promise<string>;

  open(workspaceId: WorkspaceId, file: Attachment): Promise<AttachmentContent>;
}
