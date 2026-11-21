import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { HarnessProfileRecord } from '@configuration/application/ports/harness-profile-resources.port';
import type { SecretsAwaitingValuePort } from '@configuration/application/ports/secrets-awaiting-value.port';
import { HarnessProfileProblems } from '@configuration/application/rendering/harness-profile-problems';
import { awaitingSecrets } from '@configuration/domain/services/awaiting-secrets';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { distinct } from '@shared-kernel/domain/distinct';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamProfileRecord {
  readonly record: HarnessProfileRecord;
  readonly teamKey: string;
}

export class HarnessProfileViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HarnessProfileCompilerPort,
    private readonly awaitingValue: SecretsAwaitingValuePort,
  ) {}

  async of(
    record: HarnessProfileRecord,
  ): Promise<HarnessProfileResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    if (!team) {
      return null;
    }

    const [viewed] = await this.inWorkspace(team.workspaceId, [
      { record, teamKey: team.key },
    ]);

    return viewed ?? null;
  }

  async inWorkspace(
    workspaceId: WorkspaceId,
    profiles: readonly TeamProfileRecord[],
  ): Promise<readonly HarnessProfileResourceDto[]> {
    const awaiting = await this.awaitingValue.awaitingValueIn(
      workspaceId,
      distinct(
        profiles.flatMap(({ record }) =>
          record.settings.secretReferences.map((each) => each.name),
        ),
      ),
    );

    return profiles.map(({ record, teamKey }) =>
      this.viewed(
        record,
        teamKey,
        HarnessProfileProblems.awaitingValue(
          record.key.value,
          awaitingSecrets(record.settings, awaiting),
        ),
      ),
    );
  }

  exported(
    record: HarnessProfileRecord,
    teamKey: string,
  ): HarnessProfileResourceDto {
    return this.viewed(record, teamKey, []);
  }

  private viewed(
    record: HarnessProfileRecord,
    teamKey: string,
    problems: readonly ConfigurationProblem[],
  ): HarnessProfileResourceDto {
    const parsed = { key: record.key, settings: record.settings };

    return {
      id: record.id,
      version: record.version,
      address: TeamAddress.of(teamKey, parsed.key.value).toString(),
      teamId: record.teamId.value,
      key: parsed.key.value,
      permissions: parsed.settings.permissions,
      mcpServers: HarnessProfileMapper.servers(parsed.settings),
      native: parsed.settings.native,
      secrets: parsed.settings.secrets.map((each) => each.value),
      env: parsed.settings.env,
      secretReferences: parsed.settings.secretReferences.map(
        ({ path, name }) => ({ path, name: name.value }),
      ),
      warnings: [...this.compiler.warningsOf(parsed), ...problems],
    };
  }
}
