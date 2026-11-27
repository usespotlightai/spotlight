import type { SecretSandbox } from '@secrets/domain/value-objects/secret-sandbox.vo';
import type { SecretValueOriginKind } from '@secrets/domain/value-objects/secret-value-origin.vo';

export interface SecretReachDto {
  readonly usedByRuns: boolean;
  readonly deliverable: boolean;
}

export interface WorkspaceSecretDto {
  readonly name: string;
  readonly hosts: readonly string[];
  readonly sandbox: SecretSandbox;
  readonly valueOrigin: SecretValueOriginKind;
  readonly valueSetAt: Date | null;
  readonly settable: boolean;
  readonly reach: SecretReachDto;
}
