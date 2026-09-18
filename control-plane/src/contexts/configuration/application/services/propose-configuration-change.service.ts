import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@configuration/application/services/configuration-target.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ProposalTarget {
  readonly team: TeamStanding;
  readonly into: ConfigurationRepo | null;
}

export interface ConfigurationChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly title: string;
  readonly body: string;
  readonly written: (target: ProposalTarget) => Promise<{
    readonly files: readonly ConfigurationFile[];
    readonly removes?: readonly string[];
  }>;
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

    const into = await this.target.of(team);
    const written = await change.written({ team, into });

    if (!into || written.files.length + (written.removes?.length ?? 0) === 0) {
      return null;
    }

    return this.writing.writeInto(into, {
      title: change.title,
      body: change.body,
      ...written,
    });
  }
}
