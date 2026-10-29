import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestCloseReason } from '@replays/domain/value-objects/config-pull-request-state';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigPullRequestReopened implements DomainEvent {
  readonly kind = 'replays.config-pull-request-reopened';

  constructor(
    readonly pullRequestId: ConfigPullRequestId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly stationId: string,
    readonly closedBecause: ConfigPullRequestCloseReason,
    readonly proposing: StationFingerprint,
    readonly at: Date,
  ) {}
}
