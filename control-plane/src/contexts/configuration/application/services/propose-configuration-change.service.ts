import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ConfigurationChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly title: string;
  readonly body: string;
  readonly files: readonly ConfigurationFile[];
  readonly removes: readonly string[];
}

export class ProposeConfigurationChange {
  constructor(
    private readonly teams: TeamsPort,
    private readonly target: ConfigurationTarget,
    private readonly writing: WriteConfiguration,
  ) {}

  async propose(
    change: ConfigurationChange,
  ): Promise<OpenedPullRequestDto | null> {
    const team = await this.teams.viewedBy(
      change.teamId,
      UserId.of(change.viewerId),
    );

    if (!team) {
      return null;
    }

    if (change.files.length + change.removes.length === 0) {
      return null;
    }

    const into = await this.target.of(team);

    if (!into) {
      return null;
    }

    return this.writing.writeInto(into, {
      title: change.title,
      body: change.body,
      files: change.files,
      removes: change.removes,
    });
  }
}
