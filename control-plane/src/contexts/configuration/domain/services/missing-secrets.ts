import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const missingSecrets = (
  settings: ProfileSettings,
  existing: readonly SecretName[],
): readonly SecretReference[] =>
  settings.secretReferences.filter(
    (reference) => !reference.isToAnyOf(existing),
  );
