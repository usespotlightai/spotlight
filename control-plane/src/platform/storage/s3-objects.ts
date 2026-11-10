import {
  HeadObjectCommand,
  type HeadObjectCommandInput,
  type HeadObjectCommandOutput,
  type S3Client,
} from '@aws-sdk/client-s3';

export const missing = (error: unknown): null => {
  if (
    (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode === 404
  ) {
    return null;
  }

  throw error;
};

export const headObject = (
  client: Pick<S3Client, 'send'>,
  input: HeadObjectCommandInput,
): Promise<HeadObjectCommandOutput | null> =>
  client.send(new HeadObjectCommand(input)).catch(missing);
