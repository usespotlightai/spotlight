import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { ReadinessCheck } from '@platform/health/readiness-checks';
import type { KeyOverlay } from '@platform/storage/key-overlay';

// A write under pending/, because the documented bucket policy grants no s3:ListBucket.
const PROBE_KEY = 'pending/readiness';

export class S3Readiness implements ReadinessCheck {
  readonly name = 's3';

  constructor(
    private readonly client: Pick<S3Client, 'send'>,
    private readonly bucket: string,
    private readonly keys: KeyOverlay,
  ) {}

  async check(signal: AbortSignal): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keys.writeKey(PROBE_KEY),
        Body: '',
      }),
      { abortSignal: signal },
    );
  }
}
