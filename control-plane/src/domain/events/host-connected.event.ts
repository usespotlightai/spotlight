import type { DomainEvent } from '@domain/events/domain-event';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * A team now acts as itself in a host it did not before.
 *
 * Worth saying out loud rather than doing quietly: a connection is what lets a
 * team's outbound calls authenticate as the team, and what should follow from
 * one being made is not the connecting's business.
 */
export class HostConnected implements DomainEvent {
  readonly kind = 'host.connected';

  constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
  ) {}
}
