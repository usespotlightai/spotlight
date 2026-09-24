import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretGrant {
  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly secretId: SecretId,
    readonly host: string,
  ) {}

  static of(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    secretId: SecretId;
    host: string;
  }): SecretGrant {
    return new SecretGrant(
      input.runId,
      input.workspaceId,
      input.secretId,
      input.host,
    );
  }

  equals(other: SecretGrant): boolean {
    return (
      this.runId.equals(other.runId) &&
      this.secretId.equals(other.secretId) &&
      this.host === other.host
    );
  }
}
