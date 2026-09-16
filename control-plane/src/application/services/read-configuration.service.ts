import {
  INTEGRATIONS_UNDER,
  LINES_UNDER,
  sealedVaultIn,
} from '@application/contracts/configuration-layout.contract';
import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { SkillReaderPort } from '@application/ports/skill-reader.port';
import { ConfigurationGaps } from '@application/rendering/configuration-gaps';
import { VaultProblems } from '@application/rendering/vault-problems';
import type { ApplyLines } from '@application/services/apply-lines.service';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import type {
  HeldConfiguration,
  Holding,
} from '@application/services/held-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { TeamVault } from '@application/services/team-vault.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import {
  secretsMissing,
  secretsWrittenIn,
  skillToolsUnoffered,
  stationSkillsUndefined,
  stationToolsUnoffered,
} from '@domain/services/configuration-gaps';
import { landConfigurationMove } from '@domain/services/configuration-move';
import { Commit } from '@domain/value-objects/commit.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';

export interface Read {
  readonly repository: string;
  readonly sha: string;
  readonly problems: readonly ConfigurationProblem[];
}

export class ReadConfiguration {
  constructor(
    private readonly catalog: RepositoryCatalogPort,
    private readonly target: ConfigurationTarget,
    private readonly held: HeldConfiguration,
    private readonly integrations: IntegrationReaderPort,
    private readonly skills: SkillReaderPort,
    private readonly vault: TeamVault,
    private readonly lines: ApplyLines,
    private readonly teams: TeamRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly events: DomainEventDispatcher,
    private readonly clock: ClockPort,
    private readonly settling: SettleSetup,
  ) {}

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

    const integrationFiles = holding.files.filter((each) =>
      each.isUnder(INTEGRATIONS_UNDER),
    );
    const lineFiles = holding.files.filter((each) => each.isUnder(LINES_UNDER));

    const integrationsRead = this.integrations.read(integrationFiles);
    const offered = integrationsRead.integrations.flatMap((each) =>
      each.offers.map((declared) => declared.tool),
    );

    const skillsRead = this.skills.read(holding.files);
    const skills = skillsRead.skills.map((each) => each.skill);

    const reading = TeamConfiguration.read({
      teamId: team.id,
      repository: holding.repository,
      commit: Commit.of(holding.sha),
      files: holding.files,
      readAt: this.clock.now(),
    });
    const sealed = sealedVaultIn(reading.files);
    const vault = sealed ? await this.vault.read(team.id, sealed) : null;

    const lines = await this.lines.apply(team.id, lineFiles);

    const problems: ConfigurationProblem[] = [
      ...integrationsRead.problems,
      ...skillsRead.problems,
      ...(vault?.refusal ? [VaultProblems.problem(vault.refusal)] : []),
      ...secretsMissing(skills, vault?.names ?? []).map(
        ConfigurationGaps.secretMissing,
      ),
      ...secretsWrittenIn(
        skillsRead.skills.map((each) => ({
          skill: each.skill.key,
          texts: each.files.map((file) => file.text),
        })),
      ).map(ConfigurationGaps.secretWritten),
      ...skillToolsUnoffered(skills, offered).map(
        ConfigurationGaps.skillToolUnoffered,
      ),
      ...stationToolsUnoffered(lines.plans, offered).map(
        ConfigurationGaps.stationToolUnoffered,
      ),
      ...stationSkillsUndefined(lines.plans, skills).map(
        ConfigurationGaps.stationSkillUndefined,
      ),
      ...lines.problems,
    ];

    await this.configurations.save(reading.withProblems(problems));

    await this.settling.forTeam(team.id);

    return {
      repository: holding.repository.value,
      sha: holding.sha,
      problems,
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
