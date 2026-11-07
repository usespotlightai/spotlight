import {
  type HarnessProfileShape,
  readyProfileOf,
} from '@runs/application/contracts/harness-profile.contract';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';

export const ReadyProfileMapper = {
  toReady(shape: HarnessProfileShape): ReadyProfile {
    return readyProfileOf(shape);
  },
};
