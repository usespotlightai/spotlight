import type {
  ProfileSettings,
  WornSecret,
} from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const missingSecrets = (
  settings: ProfileSettings,
  existing: readonly SecretName[],
): readonly WornSecret[] =>
  settings.wornSecrets.filter(
    (worn) => !existing.some((each) => each.equals(worn.secret)),
  );
