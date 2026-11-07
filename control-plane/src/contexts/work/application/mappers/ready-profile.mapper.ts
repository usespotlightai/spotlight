import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import {
  type ReadyProfile,
  readyProfile,
} from '@work/domain/value-objects/ready-profile';

export const ReadyProfileMapper = {
  toReady(shape: HarnessProfileShape): ReadyProfile {
    return readyProfile(ProfileKey.of(shape.key), shape);
  },
};
