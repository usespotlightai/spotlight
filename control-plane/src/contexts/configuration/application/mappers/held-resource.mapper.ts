import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HeldResourceDto } from '@configuration/application/dto/held-configuration.dto';
import type { HeldIntegration } from '@configuration/application/ports/held-integrations.port';
import type { KeptSkill } from '@configuration/application/ports/skill-resources.port';
import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { WorkspaceProfile } from '@identity/application/ports/workspace-reader.port';
import type {
  ConfiguredRunner,
  ConfiguredRunnerTrust,
  ConfiguredWorkspaceRunners,
} from '@runners/application/ports/runner-configuration.port';
import type { ConfiguredSecret } from '@secrets/application/ports/secret-configuration.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { KeptLine } from '@work/application/ports/line-resources.port';

export const HeldResourceMapper = {
  workspace(workspace: WorkspaceProfile): HeldResourceDto {
    return {
      kind: 'workspace',
      id: workspace.id,
      address: workspace.slug,
      slug: workspace.slug,
      name: workspace.name,
    };
  },

  team(team: TeamProfile): HeldResourceDto {
    return {
      kind: 'team',
      heldBy: 'workspace',
      id: team.id.value,
      address: team.key,
      key: team.key,
      name: team.name,
    };
  },

  secret(secret: ConfiguredSecret): HeldResourceDto {
    return {
      kind: 'secret',
      heldBy: 'workspace',
      id: secret.id,
      address: secret.address,
      name: secret.name,
      source: { ...secret.source },
      bindings: secret.bindings.map((each) => ({ ...each })),
      keepsValue: secret.keepsValue,
      valueVersion: secret.valueVersion,
    };
  },

  runner(runner: ConfiguredRunner): HeldResourceDto {
    return {
      kind: 'runner',
      heldBy: 'workspace',
      id: runner.id,
      address: runner.address,
      name: runner.name,
      labels: [...runner.labels],
    };
  },

  trust(trust: ConfiguredRunnerTrust): HeldResourceDto {
    return {
      kind: 'runner-trust',
      heldBy: 'workspace',
      id: trust.id,
      address: trust.address,
      key: trust.key,
      issuer: trust.issuer,
      subject: trust.subject,
      audience: trust.audience,
      labels: [...trust.labels],
    };
  },

  declared(declared: ConfiguredWorkspaceRunners): HeldResourceDto {
    return {
      kind: 'workspace-runners',
      heldBy: 'workspace',
      id: declared.id,
      address: declared.address,
      runners: [...declared.runners],
      trusts: [...declared.trusts],
    };
  },

  line(teamKey: string, line: KeptLine): HeldResourceDto {
    return {
      kind: 'line',
      heldBy: 'team',
      id: line.id,
      address: TeamAddress.of(teamKey, line.key).toString(),
      teamKey,
      key: line.key,
      definition: line.definition,
    };
  },

  skill(teamKey: string, skill: KeptSkill): HeldResourceDto {
    return {
      kind: 'skill',
      heldBy: 'team',
      id: skill.id,
      address: TeamAddress.of(teamKey, skill.key).toString(),
      teamKey,
      key: skill.key,
      files: skill.files,
    };
  },

  profile(
    teamKey: string,
    profile: HarnessProfileResourceDto,
  ): HeldResourceDto {
    return {
      kind: 'harness-profile',
      heldBy: 'team',
      id: profile.id,
      address: profile.address,
      teamKey,
      key: profile.key,
      permissions: {
        allow: [...profile.permissions.allow],
        ask: [...profile.permissions.ask],
        deny: [...profile.permissions.deny],
      },
      mcpServers: profile.mcpServers.map((each) => ({
        name: each.name,
        command: each.command,
        args: [...each.args],
        env: { ...each.env },
      })),
      native: profile.native,
    };
  },

  integration(teamKey: string, integration: HeldIntegration): HeldResourceDto {
    return {
      kind: 'integration',
      heldBy: 'team',
      id: integration.id,
      address: integration.address,
      teamKey,
      source: integration.source,
      definition: integration.definition,
      secretsWorn: integration.secretsWorn.map((each) => ({
        path: each.path,
        name: each.name,
      })),
    };
  },
};
