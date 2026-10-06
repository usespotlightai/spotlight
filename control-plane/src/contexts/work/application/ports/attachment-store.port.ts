import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';

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

  taken(workspaceId: WorkspaceId, files: readonly Attachment[]): Promise<void>;

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
