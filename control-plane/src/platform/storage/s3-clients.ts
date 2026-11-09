import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '@platform/config/env.schema';
import { KeyOverlay } from '@platform/storage/key-overlay';

export interface S3Clients {
  readonly bucket: string;
  readonly store: S3Client;
  readonly signer: S3Client;
  readonly machineSigner: S3Client;
  readonly keys: KeyOverlay;
}

export const s3ClientsOf = (env: Env): S3Clients => {
  const shared = {
    region: env.S3_REGION,
    // If not, presigned URLs contain a pre-upload checksum that S3 rejects.
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

  return {
    bucket: env.S3_BUCKET,
    keys: KeyOverlay.of(env.S3_KEY_PREFIX),
    store: new S3Client({
      ...shared,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }),
    signer: new S3Client({
      ...shared,
      endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
      forcePathStyle: env.S3_PUBLIC_FORCE_PATH_STYLE,
    }),
    machineSigner: new S3Client({
      ...shared,
      endpoint: env.S3_RUNNER_ENDPOINT ?? env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }),
  };
};
