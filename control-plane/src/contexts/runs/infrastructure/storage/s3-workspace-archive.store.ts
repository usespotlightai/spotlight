import {
  DeleteObjectCommand,
  GetObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@platform/config/env.schema';
import { headObject, s3ClientsOf } from '@platform/storage/s3-clients';
import { StorageNotConfiguredError } from '@runs/application/errors/storage-not-configured.error';
import type {
  ArchiveUpload,
  WorkspaceArchiveStorePort,
} from '@runs/application/ports/workspace-archive-store.port';
import type {
  StoredArchive,
  WorkspaceArchive,
} from '@runs/domain/aggregates/workspace-archive.aggregate';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';

const SIGNED_FOR = 15 * 60;

const CONTENT_TYPE = 'application/gzip';
const CHECKSUM = 'x-amz-checksum-sha256';

const keyOf = (archive: WorkspaceArchive): string =>
  `workspaces/${archive.workspaceId.value}/archives/${archive.id.value}.tar.gz`;

const base64Of = (digest: ArchiveDigest): string =>
  Buffer.from(digest.sha256, 'hex').toString('base64');

const digestOf = (head: HeadObjectCommandOutput): ArchiveDigest | null =>
  head.ChecksumSHA256
    ? ArchiveDigest.of(
        Buffer.from(head.ChecksumSHA256, 'base64').toString('hex'),
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
    this.runners = clients.machineSigner;
  }

  async grantUpload(archive: WorkspaceArchive): Promise<ArchiveUpload> {
    this.assertBucket();

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
    this.assertBucket();

    const head = await headObject(this.store, {
      Bucket: this.bucket,
      Key: keyOf(archive),
      ChecksumMode: 'ENABLED',
    });

    const digest = head ? digestOf(head) : null;

    if (!head?.ContentLength || !digest) {
      return null;
    }

    return { size: ArchiveSize.of(head.ContentLength), digest };
  }

  async grantDownload(archive: WorkspaceArchive): Promise<string> {
    this.assertBucket();

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

  private assertBucket(): void {
    if (!this.bucket) {
      throw new StorageNotConfiguredError('Workspace archive');
    }
  }
}
