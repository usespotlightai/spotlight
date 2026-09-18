import {
  INTEGRATIONS_UNDER,
  sealedVaultIn,
} from '@configuration/application/contracts/configuration-layout.contract';
import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import type { LinesPort } from '@configuration/application/ports/lines.port';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import type { TeamProfile } from '@configuration/application/ports/teams.port';
import { ConfigurationGaps } from '@configuration/application/rendering/configuration-gaps';
import { VaultProblems } from '@configuration/application/rendering/vault-problems';
import type {
  HeldConfiguration,
  Holding,
} from '@configuration/application/services/held-configuration.service';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import {
  secretsMissing,
  secretsWrittenIn,
  skillToolsUnoffered,
  stationSkillsUndefined,
  stationToolsUnoffered,
} from '@configuration/domain/services/configuration-gaps';
import { landConfigurationMove } from '@configuration/domain/services/configuration-move';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { ConfiguredIntegration } from '@configuration/domain/value-objects/configured-integration.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { LINES_UNDER } from '@work/application/contracts/line-layout.contract';

export interface Read {
  readonly repository: string;
  readonly sha: string;
  readonly problems: readonly ConfigurationProblem[];
}

export class ReadConfiguration {
  constructor(
    private readonly catalog: RepositoryCatalogPort,
    private readonly held: HeldConfiguration,
    private readonly integrations: IntegrationReaderPort,
    private readonly skills: SkillReaderPort,
    private readonly vault: TeamVault,
    private readonly lines: LinesPort,
    private readonly homes: ConfigurationHomeRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async read(team: TeamProfile): Promise<Read | null> {
    if (!team.connected) {
      return null;
    }

    const begunAt = this.clock.now();
    const workspaceId = team.workspaceId;
    const home = await this.landed(workspaceId, team);
    const holding = await this.holding(workspaceId, home);

    if (!holding) {
      return null;
    }

    const integrationFiles = holding.files.filter((each) =>
      each.isUnder(INTEGRATIONS_UNDER),
    );
    const lineFiles = holding.files.filter((each) => each.isUnder(LINES_UNDER));

    const integrationsRead = this.integrations.read(integrationFiles);
    const offered = integrationsRead.integrations.flatMap((each) =>
      each.offers.map((declared) => ToolName.of(declared.tool)),
    );
    const builtIn = this.lines.offersBuiltIn.bind(this.lines);

    const skillsRead = this.skills.read(holding.files);
    const skills = skillsRead.skills.map((each) => each.skill);

    const reading = TeamConfiguration.read({
      workspaceId: team.workspaceId,
      teamId: team.teamId,
      repository: holding.repository,
      commit: Commit.of(holding.sha),
      files: holding.files,
      begunAt,
      readAt: this.clock.now(),
    });
    const sealed = sealedVaultIn(reading.files);
    const vault = sealed ? await this.vault.open(team.teamId, sealed) : null;
    const held = vault?.opened ? vault.vault.names : [];

    const lines = await this.lines.plan(team.teamId, lineFiles);

    const problems: ConfigurationProblem[] = [
      ...integrationsRead.problems,
      ...skillsRead.problems,
      ...(vault && !vault.opened ? [VaultProblems.problem(vault.refusal)] : []),
      ...secretsMissing(skills, held).map(ConfigurationGaps.secretMissing),
      ...secretsWrittenIn(
        skillsRead.skills.map((each) => ({
          skill: each.skill.key,
          texts: each.files.map((file) => file.text),
        })),
      ).map(ConfigurationGaps.secretWritten),
      ...skillToolsUnoffered(skills, offered, builtIn).map(
        ConfigurationGaps.skillToolUnoffered,
      ),
      ...stationToolsUnoffered(lines.stations, offered, builtIn).map(
        ConfigurationGaps.stationToolUnoffered,
      ),
      ...stationSkillsUndefined(lines.stations, skills).map(
        ConfigurationGaps.stationSkillUndefined,
      ),
      ...lines.problems,
    ];

    const assessed = reading.assessedWith({
      problems,
      integrations: integrationsRead.integrations.map((each) =>
        ConfiguredIntegration.of({
          source: each.source,
          name: each.name,
          path: each.path,
          connectable: each.connects,
        }),
      ),
    });

    const kept = await this.transaction.run(() =>
      this.configurations.save(assessed),
    );

    if (kept === 'superseded') {
      const standing = await this.configurations.findFor(team.teamId);

      return standing
        ? {
            repository: standing.repository.value,
            sha: standing.commit.value,
            problems: standing.problems,
          }
        : null;
    }

    return {
      repository: holding.repository.value,
      sha: holding.sha,
      problems,
    };
  }

  private async landed(
    workspaceId: WorkspaceId,
    team: TeamProfile,
  ): Promise<ConfigurationHome> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const home = await this.homeOf(team);

      try {
        return await this.landedFrom(workspaceId, home);
      } catch (error) {
        if (!(error instanceof ConfigurationHomeMovedOnError)) {
          throw error;
        }
      }
    }

    return this.homeOf(team);
  }

  private async homeOf(team: TeamProfile): Promise<ConfigurationHome> {
    return (
      (await this.homes.find(team.teamId)) ??
      ConfigurationHome.unpinned(team.workspaceId, team.teamId)
    );
  }

  private async landedFrom(
    workspaceId: WorkspaceId,
    home: ConfigurationHome,
  ): Promise<ConfigurationHome> {
    const destination = home.movingTo;

    if (!destination) {
      return home;
    }

    const there = await this.held.at({ workspaceId, repository: destination });
    const landed = landConfigurationMove(home, (there?.files.length ?? 0) > 0);

    if (landed === home) {
      return home;
    }

    await this.homes.save(landed);

    return landed;
  }

  private async holding(
    workspaceId: WorkspaceId,
    home: ConfigurationHome,
  ): Promise<Holding | null> {
    if (home.keptIn) {
      return this.held.at({ workspaceId, repository: home.keptIn });
    }

    for (const summary of await this.catalog.list(workspaceId)) {
      const found = await this.held.at({
        workspaceId,
        repository: Repository.of(summary.fullName),
      });

      if (found && found.files.length > 0) {
        return found;
      }
    }

    return null;
  }
}
