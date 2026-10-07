import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigPullRequestOpened implements DomainEvent {
  readonly kind = 'replays.config-pull-request-opened';

  constructor(
    readonly pullRequestId: ConfigPullRequestId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly lineId: string,
    readonly stationId: string,
    readonly proposing: StationFingerprint,
    readonly url: string,
    readonly at: Date,
  ) {}
}
