import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { ApplyLines } from '@application/services/apply-lines.service';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import type {
  HeldConfiguration,
  Holding,
} from '@application/services/held-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import {
  INTEGRATIONS_UNDER,
  LINES_UNDER,
  TeamConfiguration,
} from '@domain/aggregates/team-configuration.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { landConfigurationMove } from '@domain/services/configuration-move';
import { Commit } from '@domain/value-objects/commit.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';

export interface Read {
  readonly repository: string;
  /** The commit it was read at, which is what makes it worth re-reading. */
  readonly sha: string;
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Reads a team's configuration out of the repository holding it: the one it
 * keeps it in, or the first connected one with a configuration directory.
 *
 * Written down whether or not all of it was good. A file that will not read
 * leaves the last one that did still running.
 */
export class ReadConfiguration {
  constructor(
    private readonly catalog: RepositoryCatalogPort,
    private readonly target: ConfigurationTarget,
    private readonly held: HeldConfiguration,
    private readonly integrations: IntegrationReaderPort,
    private readonly lines: ApplyLines,
    private readonly teams: TeamRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly events: DomainEventDispatcher,
    private readonly clock: ClockPort,
    private readonly settling: SettleSetup,
  ) {}

  /**
   * Null where the workspace reaches no host that could hold it, or where
   * this team's configuration is nowhere to be found.
   */
  async read(workspace: Workspace, given: Team): Promise<Read | null> {
    const installation = this.target.installationOf(workspace);

    if (!installation) {
      return null;
    }

    const team = await this.landed(installation, given);
    const holding = await this.holding(installation, team);

    if (!holding) {
      return null;
    }

    // Each reader is given only its own directory, or every line would read
    // as a broken integration and every integration as a broken line.
    const integrationFiles = holding.files.filter((each) =>
      each.isUnder(INTEGRATIONS_UNDER),
    );
    const lineFiles = holding.files.filter((each) => each.isUnder(LINES_UNDER));

    // Read now rather than when a delivery arrives: a problem with a file is
    // something to be told about while looking at it, not at midnight.
    const { problems } = this.integrations.read(integrationFiles);

    // The lines are made to say what the files say. What could not be done
    // without stranding somebody's work comes back as a problem to show.
    const strandings = await this.lines.apply(team.id, lineFiles);

    await this.configurations.save(
      TeamConfiguration.read({
        teamId: team.id,
        repository: holding.repository,
        commit: Commit.of(holding.sha),
        files: holding.files,
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

  private async landed(
    installation: GitHubInstallation,
    team: Team,
  ): Promise<Team> {
    const destination = team.movingConfigurationTo;

    if (!destination) {
      return team;
    }

    const there = await this.held.at({ installation, repository: destination });
    const landed = landConfigurationMove(team, (there?.files.length ?? 0) > 0);

    if (landed === team) {
      return team;
    }

    await this.teams.save(landed);
    await this.events.dispatch(landed.pullEvents());

    return landed;
  }

  /** Where it keeps it wins outright; otherwise the first connected one holding any. */
  private async holding(
    installation: GitHubInstallation,
    team: Team,
  ): Promise<Holding | null> {
    if (team.configRepository) {
      return this.held.at({ installation, repository: team.configRepository });
    }

    for (const summary of await this.catalog.list(installation)) {
      const found = await this.held.at({
        installation,
        repository: Repository.of(summary.fullName),
      });

      if (found && found.files.length > 0) {
        return found;
      }
    }

    return null;
  }
}
