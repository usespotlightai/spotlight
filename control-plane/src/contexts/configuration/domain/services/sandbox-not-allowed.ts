import type { KnownSecrets } from '@configuration/domain/value-objects/known-secrets.vo';
import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';

export const sandboxNotAllowed = (
  settings: ProfileSettings,
  known: KnownSecrets,
): readonly SecretReference[] =>
  settings.sandboxReferences.filter(
    (reference) =>
      reference.isToAnyOf(known.existing) &&
      !reference.isToAnyOf(known.sandboxSecrets),
  );
