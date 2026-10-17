import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
import {
  headObject,
  missing,
  type S3Clients,
} from '@work/infrastructure/storage/s3-clients';

const SIGNED_FOR = 15 * 60;

const UPLOADER = 'uploader';
const NAME = 'name';

const pendingKeyOf = (workspaceId: WorkspaceId, id: AttachmentId): string =>
  `pending/${workspaceId.value}/${id.value}`;

const keyOf = (workspaceId: WorkspaceId, id: AttachmentId): string =>
  `workspaces/${workspaceId.value}/attachments/${id.value}`;

const encoded = (name: string): string => encodeURIComponent(name);

const decoded = (name: string | undefined, fallback: string): string => {
  try {
    return name ? decodeURIComponent(name) : fallback;
  } catch {
    return fallback;
  }
};

export class S3AttachmentStore implements AttachmentStorePort {
  private readonly store: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(clients: S3Clients) {
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
        const head =
          (await this.kept(workspaceId, id)) ??
          (await this.pending(workspaceId, id));

        if (!head) {
          throw new InvalidAttachmentError('was never uploaded');
        }

        return Attachment.of({
          id: id.value,
          name: decoded(head.Metadata?.[NAME], id.value),
          contentType: head.ContentType,
          size: head.ContentLength ?? -1,
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

    // Non-image files and SVG files download and do not render, so they cannot run as pages.
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
      throw new InvalidAttachmentError('is no longer stored');
    }

    return {
      bytes: await read.Body.transformToByteArray(),
      contentType: read.ContentType ?? file.contentType,
    };
  }

  async taken(
    workspaceId: WorkspaceId,
    files: readonly Attachment[],
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    this.refuseWithoutABucket();

    await Promise.all(files.map((file) => this.movedIn(workspaceId, file.id)));
  }

  private async movedIn(
    workspaceId: WorkspaceId,
    id: AttachmentId,
  ): Promise<void> {
    if (await this.kept(workspaceId, id)) {
      return;
    }

    const from = pendingKeyOf(workspaceId, id);
    const copied = await this.store
      .send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${from}`,
          Key: keyOf(workspaceId, id),
          MetadataDirective: 'COPY',
        }),
      )
      .catch(missing);

    if (!copied) {
      if (!(await this.kept(workspaceId, id))) {
        throw new InvalidAttachmentError('was never uploaded');
      }

      return;
    }

    await this.store
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: from }))
      .catch(missing);
  }

  private kept(
    workspaceId: WorkspaceId,
    id: AttachmentId,
  ): Promise<HeadObjectCommandOutput | null> {
    return headObject(this.store, {
      Bucket: this.bucket,
      Key: keyOf(workspaceId, id),
    });
  }

  private pending(
    workspaceId: WorkspaceId,
    id: AttachmentId,
  ): Promise<HeadObjectCommandOutput | null> {
    return headObject(this.store, {
      Bucket: this.bucket,
      Key: pendingKeyOf(workspaceId, id),
    });
  }

  private refuseWithoutABucket(): void {
    if (!this.bucket) {
      throw new InvalidAttachmentError(
        'storage is not configured on this deployment',
      );
    }
  }
}
