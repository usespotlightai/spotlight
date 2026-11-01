import type { ExportableResourceDto } from '@configuration/application/dto/exportable-configuration.dto';
import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HookConfig } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfig } from '@configuration/application/ports/integration-configs.port';
import type { SkillRecord } from '@configuration/application/ports/skill-resources.port';
import type { OidcTrustView } from '@identity/application/ports/oidc-trust-configuration.port';
import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { WorkspaceProfile } from '@identity/application/ports/workspace-reader.port';
import type {
  EgressView,
  RunnerPoolView,
  RunnerTrustView,
  WorkspaceRunnersView,
} from '@runners/application/ports/runner-configuration.port';
import type { SecretView } from '@secrets/application/ports/secret-configuration.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { LineRecord } from '@work/application/ports/line-resources.port';

export const ExportableResourceMapper = {
  workspace(workspace: WorkspaceProfile): ExportableResourceDto {
    return {
      kind: 'workspace',
      id: workspace.id,
      address: workspace.slug,
      slug: workspace.slug,
      name: workspace.name,
      outboundHosts: workspace.outboundHosts,
    };
  },

  team(team: TeamProfile): ExportableResourceDto {
    return {
      kind: 'team',
      ownedBy: 'workspace',
      id: team.id.value,
      address: team.key,
      key: team.key,
      name: team.name,
    };
  },

  secret(secret: SecretView): ExportableResourceDto {
    return {
      kind: 'secret',
      ownedBy: 'workspace',
      id: secret.id,
      address: secret.address,
      name: secret.name,
      source: { ...secret.source },
      bindings: secret.bindings.map((each) => ({ ...each })),
      storesValue: secret.storesValue,
      valueVersion: secret.valueVersion,
    };
  },

  oidcTrust(trust: OidcTrustView): ExportableResourceDto {
    return {
      kind: 'oidc-trust',
      ownedBy: 'workspace',
      id: trust.id,
      address: trust.address,
      key: trust.key,
      issuer: trust.issuer,
      audience: trust.audience,
      subject: trust.subject,
      claims: { ...trust.claims },
      scopes: [...trust.scopes],
      lifetimeMinutes: trust.lifetimeMinutes,
    };
  },

  trust(trust: RunnerTrustView): ExportableResourceDto {
    return {
      kind: 'runner-trust',
      ownedBy: 'workspace',
      id: trust.id,
      address: trust.address,
      key: trust.key,
      issuer: trust.issuer,
      subject: trust.subject,
      audience: trust.audience,
      labels: [...trust.labels],
    };
  },

  pool(pool: RunnerPoolView): ExportableResourceDto {
    return {
      kind: 'runner-pool',
      ownedBy: 'workspace',
      id: pool.id,
      address: pool.address,
      key: pool.key,
      labels: [...pool.labels],
      maxRuns: pool.maxRuns,
      tokenVersion: pool.tokenVersion,
      provision: pool.provision ? { ...pool.provision } : null,
    };
  },

  egress(egress: EgressView): ExportableResourceDto {
    return {
      kind: 'egress',
      ownedBy: 'workspace',
      id: egress.id,
      address: egress.address,
      key: egress.key,
      url: egress.url,
      tokenVersion: egress.tokenVersion,
    };
  },

  declared(declared: WorkspaceRunnersView): ExportableResourceDto {
    return {
      kind: 'workspace-runners',
      ownedBy: 'workspace',
      id: declared.id,
      address: declared.address,
      trusts: [...declared.trusts],
      pools: [...declared.pools],
    };
  },

  line(teamKey: string, line: LineRecord): ExportableResourceDto {
    return {
      kind: 'line',
      ownedBy: 'team',
      id: line.id,
      address: TeamAddress.of(teamKey, line.key).toString(),
      teamKey,
      key: line.key,
      definition: line.definition,
    };
  },

  skill(teamKey: string, skill: SkillRecord): ExportableResourceDto {
    return {
      kind: 'skill',
      ownedBy: 'team',
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
  ): ExportableResourceDto {
    return {
      kind: 'harness-profile',
      ownedBy: 'team',
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
      secretReferences: profile.secretReferences.map((each) => ({
        path: each.path,
        name: each.name,
      })),
    };
  },

  integration(
    teamKey: string,
    integration: IntegrationConfig,
  ): ExportableResourceDto {
    return {
      kind: 'integration',
      ownedBy: 'team',
      id: integration.id,
      address: integration.address,
      teamKey,
      integration: integration.integration,
      definition: integration.definition,
      secretReferences: integration.secretReferences.map((each) => ({
        path: each.path,
        name: each.name,
      })),
    };
  },

  hook(teamKey: string, hook: HookConfig): ExportableResourceDto {
    return {
      kind: 'hook',
      ownedBy: 'team',
      id: hook.id,
      address: hook.address,
      teamKey,
      key: hook.key,
      on: hook.on,
      match: hook.match,
      when: hook.when,
      vars: hook.vars,
      steps: hook.steps,
      signing: hook.signing,
      failure: hook.failure,
      timeoutSeconds: hook.timeoutSeconds,
    };
  },
};
