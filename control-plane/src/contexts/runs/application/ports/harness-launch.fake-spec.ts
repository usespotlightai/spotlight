import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { readyProfile } from '@runs/domain/value-objects/ready-profile';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';

export const readyProfiles: Pick<HarnessLaunchPort, 'readyProfile'> = {
  readyProfile: (shape) => readyProfile(ProfileKey.of(shape.key), shape),
};
