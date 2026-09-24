import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const SECRET_GRANTS = Symbol('SECRET_GRANTS');

export interface SecretGrantRepository {
  grant(grants: readonly SecretGrant[]): Promise<void>;

  holds(grant: SecretGrant): Promise<boolean>;

  revokeFor(runId: RunId): Promise<void>;
}
