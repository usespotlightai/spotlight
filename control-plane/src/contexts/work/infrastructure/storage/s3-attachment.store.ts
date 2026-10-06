import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@platform/config/env.schema';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  AttachmentContent,
  AttachmentStorePort,
  UploadGrant,
  Wanted,
} from '@work/application/ports/attachment-store.port';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { missing, s3ClientsOf } from '@work/infrastructure/storage/s3-clients';

const SIGNED_FOR = 15 * 60;

const UPLOADER = 'uploader';
const NAME = 'name';

// An upload lands under pending/ and is copied under its workspace once a
// task claims it. Buckets expire by prefix, so a rule on pending/ clears what
// was never claimed without ever matching a kept attachment or an archive.
const pendingKeyOf = (workspaceId: WorkspaceId, id: AttachmentId): string =>
  `pending/${workspaceId.value}/${id.value}`;

const keyOf = (workspaceId: WorkspaceId, id: AttachmentId): string =>
  `workspaces/${workspaceId.value}/attachments/${id.value}`;

const encoded = (name: string): string => encodeURIComponent(name);

const decoded = (held: string | undefined, fallback: string): string => {
  try {
    return held ? decodeURIComponent(held) : fallback;
  } catch {
    return fallback;
  }
};

export class S3AttachmentStore implements AttachmentStorePort {
  private readonly store: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    const clients = s3ClientsOf(env);

    this.bucket = clients.bucket;
    this.store = clients.store;
    this.signer = clients.signer;
  }

  async grant(
    workspaceId: WorkspaceId,
    uploader: UserId,
    file: Attachment,
  ): Promise<UploadGrant> {
    this.refuseWithoutABucket();

    const headers = {
      'content-type': file.contentType,
      [`x-amz-meta-${UPLOADER}`]: uploader.value,
      [`x-amz-meta-${NAME}`]: encoded(file.name),
    };

    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: pendingKeyOf(workspaceId, file.id),
        ContentType: file.contentType,
        ContentLength: file.size,
        Metadata: { [UPLOADER]: uploader.value, [NAME]: encoded(file.name) },
      }),
      {
        expiresIn: SIGNED_FOR,
        signableHeaders: new Set(['content-type', 'content-length']),
        unhoistableHeaders: new Set(Object.keys(headers)),
      },
    );

    return { url, headers };
  }

  async received(
    workspaceId: WorkspaceId,
    ids: readonly AttachmentId[],
  ): Promise<Attachment[]> {
    if (ids.length === 0) {
      return [];
    }

    this.refuseWithoutABucket();

    return Promise.all(
      [...new Set(ids)].map(async (id) => {
        const held = await this.claim(workspaceId, id);

        if (!held) {
          throw new InvalidAttachmentError('was never uploaded');
        }

        return Attachment.of({
          id: id.value,
          name: decoded(held.Metadata?.[NAME], id.value),
          contentType: held.ContentType,
          size: held.ContentLength ?? -1,
        });
      }),
    );
  }

  async keep(
    workspaceId: WorkspaceId,
    file: Attachment,
    bytes: Uint8Array,
  ): Promise<void> {
    this.refuseWithoutABucket();

    await this.store.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(workspaceId, file.id),
        Body: bytes,
        ContentType: file.contentType,
        Metadata: { [NAME]: encoded(file.name) },
      }),
    );
  }

  async link(
    workspaceId: WorkspaceId,
    file: Attachment,
    wanted: Wanted,
  ): Promise<string> {
    this.refuseWithoutABucket();

    // Non-images (and SVG) download rather than render, so they cannot run as pages.
    const shown =
      wanted === 'shown' && file.image && file.contentType !== 'image/svg+xml';

    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(workspaceId, file.id),
        ResponseContentType: file.contentType,
        ResponseContentDisposition: `${shown ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded(file.name)}`,
      }),
      { expiresIn: SIGNED_FOR },
    );
  }

  async open(
    workspaceId: WorkspaceId,
    file: Attachment,
  ): Promise<AttachmentContent> {
    this.refuseWithoutABucket();

    const read = await this.store.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(workspaceId, file.id),
      }),
    );

    if (!read.Body) {
      throw new InvalidAttachmentError('was kept, but is no longer there');
    }

    return {
      bytes: await read.Body.transformToByteArray(),
      contentType: read.ContentType ?? file.contentType,
    };
  }

  // Moves a pending upload under its workspace. An attachment already there,
  // say one sent with a second message, is simply read.
  private async claim(
    workspaceId: WorkspaceId,
    id: AttachmentId,
  ): Promise<HeadObjectCommandOutput | null> {
    const key = keyOf(workspaceId, id);
    const kept = await this.head(key);

    if (kept) {
      return kept;
    }

    const pendingKey = pendingKeyOf(workspaceId, id);
    const pending = await this.head(pendingKey);

    if (!pending) {
      return null;
    }

    await this.store.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${pendingKey}`,
        Key: key,
        MetadataDirective: 'COPY',
      }),
    );

    // The bucket's rule would expire the original anyway; this just saves it
    // the trouble.
    await this.store
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: pendingKey }))
      .catch(() => undefined);

    return pending;
  }

  private head(key: string): Promise<HeadObjectCommandOutput | null> {
    return this.store
      .send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(missing);
  }

  private refuseWithoutABucket(): void {
    if (!this.bucket) {
      throw new InvalidAttachmentError(
        'cannot be kept, because this deployment has nowhere to keep one',
      );
    }
  }
}
