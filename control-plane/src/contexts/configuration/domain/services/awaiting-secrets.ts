import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const awaitingSecrets = (
  settings: ProfileSettings,
  awaiting: readonly SecretName[],
): readonly SecretReference[] =>
  settings.secretReferences.filter((reference) =>
    reference.isToAnyOf(awaiting),
  );
