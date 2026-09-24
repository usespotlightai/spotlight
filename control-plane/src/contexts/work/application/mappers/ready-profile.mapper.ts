import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';

export const ReadyProfileMapper = {
  toReady(shape: HarnessProfileShape): ReadyProfile {
    return { ...shape, key: ProfileKey.of(shape.key) };
  },
};
