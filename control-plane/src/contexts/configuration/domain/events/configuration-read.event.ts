import type { Commit } from '@configuration/domain/value-objects/commit.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigurationRead implements DomainEvent {
  readonly kind = 'configuration.read';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly commit: Commit,
    readonly files: readonly ConfigurationFile[],
  ) {}
}
