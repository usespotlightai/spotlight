import type { Env } from '@platform/config/env.schema';
import type { SandboxHostsPort } from '@work/application/ports/sandbox-hosts.port';

const storageHostOf = (env: Env): string => {
  const endpoint = env.S3_RUNNER_ENDPOINT ?? env.S3_ENDPOINT;

  if (endpoint) {
    return new URL(endpoint).hostname;
  }

  const regional = `s3.${env.S3_REGION}.amazonaws.com`;

  return env.S3_FORCE_PATH_STYLE ? regional : `${env.S3_BUCKET}.${regional}`;
};

export class StorageHosts implements SandboxHostsPort {
  private readonly allowed: readonly string[];

  constructor(env: Env) {
    this.allowed = [storageHostOf(env)];
  }

  hosts(): readonly string[] {
    return this.allowed;
  }
}
