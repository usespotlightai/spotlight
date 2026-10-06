import {
  DeleteObjectCommand,
  GetObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@platform/config/env.schema';
import type {
  ArchiveUpload,
  WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import type {
  StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import {
  headObject,
  s3ClientsOf,
} from '@work/infrastructure/storage/s3-clients';

const SIGNED_FOR = 15 * 60;

const CONTENT_TYPE = 'application/gzip';
const CHECKSUM = 'x-amz-checksum-sha256';

const keyOf = (archive: WorkspaceArchive): string =>
  `workspaces/${archive.workspaceId.value}/archives/${archive.id.value}.tar.gz`;

const base64Of = (digest: ArchiveDigest): string =>
  Buffer.from(digest.sha256, 'hex').toString('base64');

const digestOf = (held: HeadObjectCommandOutput): ArchiveDigest | null =>
  held.ChecksumSHA256
    ? ArchiveDigest.of(
        Buffer.from(held.ChecksumSHA256, 'base64').toString('hex'),
      )
    : null;

export class S3WorkspaceArchiveStore implements WorkspaceArchiveStorePort {
  private readonly store: S3Client;
  private readonly runners: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    const clients = s3ClientsOf(env);

    this.bucket = clients.bucket;
    this.store = clients.store;
    this.runners = clients.runners;
  }

  async grantUpload(archive: WorkspaceArchive): Promise<ArchiveUpload> {
    this.refuseWithoutABucket();

    const headers = {
      'content-type': CONTENT_TYPE,
      [CHECKSUM]: base64Of(archive.digest),
    };

    const url = await getSignedUrl(
      this.runners,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(archive),
        ContentType: CONTENT_TYPE,
        ContentLength: archive.size.bytes,
        ChecksumSHA256: base64Of(archive.digest),
      }),
      {
        expiresIn: SIGNED_FOR,
        signableHeaders: new Set(['content-type', 'content-length', CHECKSUM]),
        unhoistableHeaders: new Set(Object.keys(headers)),
      },
    );

    return { url, headers };
  }

  async stored(archive: WorkspaceArchive): Promise<StoredArchive | null> {
    this.refuseWithoutABucket();

    const held = await headObject(this.store, {
      Bucket: this.bucket,
      Key: keyOf(archive),
      ChecksumMode: 'ENABLED',
    });

    const digest = held ? digestOf(held) : null;

    if (!held?.ContentLength || !digest) {
      return null;
    }

    return { size: ArchiveSize.of(held.ContentLength), digest };
  }

  async grantDownload(archive: WorkspaceArchive): Promise<string> {
    this.refuseWithoutABucket();

    return getSignedUrl(
      this.runners,
      new GetObjectCommand({ Bucket: this.bucket, Key: keyOf(archive) }),
      { expiresIn: SIGNED_FOR },
    );
  }

  async remove(archive: WorkspaceArchive): Promise<void> {
    if (!this.bucket) {
      return;
    }

    await this.store.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: keyOf(archive) }),
    );
  }

  private refuseWithoutABucket(): void {
    if (!this.bucket) {
      throw new InvalidWorkspaceArchiveError(
        'cannot be kept, because this deployment has nowhere to keep one',
      );
    }
  }
}
