import type { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HarnessProfileDeleted implements ConfigurationChanged {
  readonly kind = 'configuration.harness-profile-deleted';

  constructor(
    readonly id: HarnessProfileId,
    readonly teamId: TeamId,
    readonly key: ProfileKey,
    readonly change: ConfigurationChange,
  ) {}
}
