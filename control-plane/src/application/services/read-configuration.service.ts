import type { ClockPort } from '@application/ports/clock.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { ApplyLines } from '@application/services/apply-lines.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import {
  KEPT_UNDER,
  TeamConfiguration,
} from '@domain/aggregates/team-configuration.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';

export interface Read {
  readonly repository: string;
  /** The commit it was read at, which is what makes it worth re-reading. */
  readonly sha: string;
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Reads a team's configuration out of the repository holding it: the one it
 * pinned, or the first connected one with a configuration directory.
 *
 * Written down whether or not all of it was good. A file that will not read
 * leaves the last one that did still running.
 */
export class ReadConfiguration {
  constructor(
    private readonly catalog: RepositoryCatalogPort,
    private readonly contents: RepositoryContentsPort,
    private readonly integrations: IntegrationReaderPort,
    private readonly lines: ApplyLines,
    private readonly configurations: TeamConfigurationRepository,
    private readonly clock: ClockPort,
    private readonly settling: SettleSetup,
  ) {}

  /**
   * Null where the workspace reaches no host that could hold it, or where
   * this team's configuration is nowhere to be found.
   */
  async read(workspace: Workspace, team: Team): Promise<Read | null> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );

    if (!installation) {
      return null;
    }

    const holding = await this.holding(installation, team);

    if (!holding) {
      return null;
    }

    const files = (
      await this.contents.under({
        installation,
        repository: holding.repository,
        ref: holding.sha,
        path: KEPT_UNDER,
      })
    ).map((each) => ConfigurationFile.of(each.path, each.text));

    // Read now rather than when a delivery arrives: a problem with a file is
    // something to be told about while looking at it, not at midnight.
    const { problems } = this.integrations.read(files);

    // The lines are made to say what the files say. What could not be done
    // without stranding somebody's work comes back as a problem to show.
    const strandings = await this.lines.apply(team.id, files);

    await this.configurations.save(
      TeamConfiguration.read({
        teamId: team.id,
        repository: holding.repository,
        commit: Commit.of(holding.sha),
        files,
        problems: [...problems, ...strandings],
        readAt: this.clock.now(),
      }),
    );

    // Two steps at once: the setup pull request is merged when its files can
    // be read, and the tools chosen are the ones those files listen to.
    await this.settling.forTeam(team.id);

    return {
      repository: holding.repository.value,
      sha: holding.sha,
      problems: [...problems, ...strandings],
    };
  }

  /** Pinned wins outright; otherwise the first connected one holding any. */
  private async holding(
    installation: GitHubInstallation,
    team: Team,
  ): Promise<{ repository: Repository; sha: string } | null> {
    if (team.configRepository) {
      const sha = await this.contents.headOf(
        installation,
        team.configRepository,
      );

      return sha ? { repository: team.configRepository, sha } : null;
    }

    for (const summary of await this.catalog.list(installation)) {
      const repository = Repository.of(summary.fullName);
      const sha = await this.contents.headOf(installation, repository);

      if (!sha) {
        continue;
      }

      const found = await this.contents.under({
        installation,
        repository,
        ref: sha,
        path: KEPT_UNDER,
      });

      if (found.length > 0) {
        return { repository, sha };
      }
    }

    return null;
  }
}
