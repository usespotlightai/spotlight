import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const missingSecrets = (
  settings: ProfileSettings,
  existing: readonly SecretName[],
): readonly SecretReferenceAt[] =>
  settings.secretReferences.filter(
    (reference) => !existing.some((each) => each.value === reference.name),
  );
