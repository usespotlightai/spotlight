import type {
  ProfileSettings,
  WornSecret,
} from '@configuration/domain/value-objects/profile-settings.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const unheldSecrets = (
  settings: ProfileSettings,
  held: readonly SecretName[],
): readonly WornSecret[] =>
  settings.wornSecrets.filter(
    (worn) => !held.some((each) => each.equals(worn.secret)),
  );
