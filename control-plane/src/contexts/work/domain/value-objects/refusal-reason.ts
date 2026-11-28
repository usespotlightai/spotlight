import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import type { RepositoriesMissing } from '@work/domain/value-objects/repositories-missing.vo';
import type { SecretAwaitingValue } from '@work/domain/value-objects/secret-awaiting-value.vo';
import type { SecretSandboxNotAllowed } from '@work/domain/value-objects/secret-sandbox-not-allowed.vo';

export type RefusalReason =
  | RepositoriesMissing
  | DeniedCatalogItem
  | ProfileMissing
  | SecretAwaitingValue
  | SecretSandboxNotAllowed;
