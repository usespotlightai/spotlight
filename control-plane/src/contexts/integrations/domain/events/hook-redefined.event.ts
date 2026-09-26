import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HookRedefined implements ConfigurationChanged {
  readonly kind = 'integrations.hook-redefined';

  constructor(
    readonly id: HookDefinitionId,
    readonly teamId: TeamId,
    readonly key: HookKey,
    readonly change: ConfigurationChange,
  ) {}
}
