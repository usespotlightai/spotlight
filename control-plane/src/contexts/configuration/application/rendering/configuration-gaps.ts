import {
  integrationPath,
  skillFile,
} from '@configuration/application/contracts/configuration-layout.contract';
import type {
  CredentialMissing,
  SecretMissing,
  SecretWritten,
  SkillToolUnoffered,
  StationSkillUndefined,
  StationToolUnoffered,
} from '@configuration/domain/services/configuration-gaps';
import type { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

const unoffered = (verb: string, tool: ToolName): string =>
  tool.integration
    ? `${verb} ${tool.value}, which no integration of the team’s offers: add ${tool.name} under tools in ${integrationPath(tool.integration)}`
    : `${verb} ${tool.value}, which Spotlight has no tool by: take it away`;

export const ConfigurationGaps = {
  secretMissing(gap: SecretMissing): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill.value),
      at: `secrets.${gap.secret.value}`,
      reason: `needs ${gap.secret.value}, which the team does not hold: no run is given this skill until it does`,
      severity: 'warning',
    });
  },

  credentialMissing(gap: CredentialMissing): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: gap.path,
      at: `secret.${gap.secret.value}`,
      reason: `reads secret.${gap.secret.value}, which the team does not hold: whatever reads it is refused until it does`,
    });
  },

  secretWritten(gap: SecretWritten): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill.value),
      at: 'the file',
      reason:
        'writes a secret into what a run reads, and a run is never given one: reach for it through a tool instead',
      severity: 'warning',
    });
  },

  skillToolUnoffered(gap: SkillToolUnoffered): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill.value),
      at: `tools.${gap.at}`,
      reason: unoffered('brings', gap.tool),
      severity: 'warning',
    });
  },

  stationToolUnoffered(gap: StationToolUnoffered): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: gap.path,
      at: `tools.${gap.at}`,
      reason: unoffered('gives', gap.tool),
      severity: 'warning',
    });
  },

  stationSkillUndefined(gap: StationSkillUndefined): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: gap.path,
      at: `skills.${gap.at}`,
      reason: `names ${gap.skill.value}, and the team defines no such skill: add ${skillFile(gap.skill.value)}, or take it away`,
      severity: 'warning',
    });
  },
};
