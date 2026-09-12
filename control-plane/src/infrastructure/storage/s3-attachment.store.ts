import type {
  AttachmentContent,
  AttachmentStorePort,
  UploadGrant,
  Wanted,
} from '@application/ports/attachment-store.port';
import {
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InvalidAttachmentError } from '@domain/exceptions/invalid-attachment.error';
import { Attachment } from '@domain/value-objects/attachment.vo';
import type { AttachmentId } from '@domain/value-objects/attachment-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { Env } from '@infrastructure/config/env.schema';

const SIGNED_FOR = 15 * 60;

const UPLOADER = 'uploader';
const NAME = 'name';

const keyOf = (workspaceId: WorkspaceId, id: AttachmentId): string =>
  `workspaces/${workspaceId.value}/attachments/${id.value}`;

/** Metadata is ASCII only, and a file name is anything a person typed. */
const encoded = (name: string): string => encodeURIComponent(name);

const decoded = (held: string | undefined, fallback: string): string => {
  try {
    return held ? decodeURIComponent(held) : fallback;
  } catch {
    return fallback;
  }
};

const missing = (error: unknown): null => {
  if (
    (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode === 404
  ) {
    return null;
  }

  throw error;
};

export class S3AttachmentStore implements AttachmentStorePort {
  private readonly store: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    const shared = {
      region: env.S3_REGION,
      // A signed address would otherwise carry a checksum taken before there
      // were any bytes, which S3 refuses when the browser's differ.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    };

    this.bucket = env.S3_BUCKET;
    this.store = new S3Client({
      ...shared,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
    this.signer = new S3Client({
      ...shared,
      endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
      forcePathStyle: env.S3_PUBLIC_FORCE_PATH_STYLE,
    });
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
        Key: keyOf(workspaceId, file.id),
        ContentType: file.contentType,
        ContentLength: file.size,
        Metadata: { [UPLOADER]: uploader.value, [NAME]: encoded(file.name) },
      }),
      {
        expiresIn: SIGNED_FOR,
        // Signed rather than trusted: a larger file breaks the signature.
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
        const held: HeadObjectCommandOutput | null = await this.store
          .send(
            new HeadObjectCommand({
              Bucket: this.bucket,
              Key: keyOf(workspaceId, id),
            }),
          )
          .catch(missing);

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

    // Anything a browser does not draw as a picture is handed over to be
    // saved: a page opened from the store would run as whatever it claims.
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

  private refuseWithoutABucket(): void {
    if (!this.bucket) {
      throw new InvalidAttachmentError(
        'cannot be kept, because this deployment has nowhere to keep one',
      );
    }
  }
}
