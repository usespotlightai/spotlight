import type { HeadObjectCommandOutput, S3Client } from '@aws-sdk/client-s3';
import { headObject } from '@platform/storage/s3-objects';

export interface LocatedObject {
  readonly key: string;
  readonly head: HeadObjectCommandOutput;
}

export class KeyOverlay {
  private constructor(private readonly prefix: string) {}

  static of(prefix: string | undefined): KeyOverlay {
    const trimmed = (prefix ?? '').replace(/^\/+|\/+$/g, '');

    return new KeyOverlay(trimmed ? `${trimmed}/` : '');
  }

  get prefixed(): boolean {
    return this.prefix !== '';
  }

  writeKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  readKeys(key: string): readonly string[] {
    return this.prefixed ? [this.writeKey(key), key] : [key];
  }

  owns(key: string): boolean {
    return !this.prefixed || key.startsWith(this.prefix);
  }

  async locate(
    client: Pick<S3Client, 'send'>,
    bucket: string,
    key: string,
    checksum = false,
  ): Promise<LocatedObject | null> {
    for (const each of this.readKeys(key)) {
      const head = await headObject(client, {
        Bucket: bucket,
        Key: each,
        ...(checksum ? { ChecksumMode: 'ENABLED' as const } : {}),
      });

      if (head) {
        return { key: each, head };
      }
    }

    return null;
  }

  async readKey(
    client: Pick<S3Client, 'send'>,
    bucket: string,
    key: string,
  ): Promise<string> {
    if (!this.prefixed) {
      return key;
    }

    return (await this.locate(client, bucket, key))?.key ?? this.writeKey(key);
  }
}
