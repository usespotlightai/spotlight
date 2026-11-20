import type { SecretValueOriginKind } from '@secrets/domain/value-objects/secret-value-origin.vo';

export interface WorkspaceSecretDto {
  readonly name: string;
  readonly hosts: readonly string[];
  readonly valueOrigin: SecretValueOriginKind;
  readonly valueSetAt: Date | null;
  readonly settable: boolean;
}
