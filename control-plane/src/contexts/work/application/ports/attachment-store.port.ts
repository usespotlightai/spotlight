import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
    uploader: UserId | RunId,
    file: Attachment,
  ): Promise<UploadGrant>;

  received(
    workspaceId: WorkspaceId,
    ids: readonly AttachmentId[],
    uploadedBy?: RunId,
  ): Promise<Attachment[]>;

  stored(
    workspaceId: WorkspaceId,
    ids: readonly AttachmentId[],
  ): Promise<boolean>;

  taken(workspaceId: WorkspaceId, files: readonly Attachment[]): Promise<void>;

  save(
    workspaceId: WorkspaceId,
    file: Attachment,
    bytes: Uint8Array,
  ): Promise<void>;

  copy(
    workspaceId: WorkspaceId,
    from: Attachment,
    to: Attachment,
  ): Promise<void>;

  link(
    workspaceId: WorkspaceId,
    file: Attachment,
    wanted: Wanted,
  ): Promise<string>;

  linkPending(
    workspaceId: WorkspaceId,
    id: AttachmentId,
    wanted: Wanted,
  ): Promise<string | null>;

  open(workspaceId: WorkspaceId, file: Attachment): Promise<AttachmentContent>;
}
