import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HostRenewalRefused implements DomainEvent {
  readonly kind = 'integrations.host-renewal-refused';

  constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly refusedAt: Date,
  ) {}
}
