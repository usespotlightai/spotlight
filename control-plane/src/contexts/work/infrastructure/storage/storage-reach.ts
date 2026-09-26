import type { Env } from '@platform/config/env.schema';
import type { SandboxReachPort } from '@work/application/ports/sandbox-reach.port';

const storageHostOf = (env: Env): string => {
  const endpoint = env.S3_RUNNER_ENDPOINT ?? env.S3_ENDPOINT;

  if (endpoint) {
    return new URL(endpoint).hostname;
  }

  const regional = `s3.${env.S3_REGION}.amazonaws.com`;

  return env.S3_FORCE_PATH_STYLE ? regional : `${env.S3_BUCKET}.${regional}`;
};

export class StorageReach implements SandboxReachPort {
  private readonly reached: readonly string[];

  constructor(env: Env) {
    this.reached = [storageHostOf(env)];
  }

  hosts(): readonly string[] {
    return this.reached;
  }
}
