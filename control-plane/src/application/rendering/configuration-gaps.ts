import {
  integrationPath,
  SECRETS_VAULT,
  skillFile,
  stationPath,
} from '@application/contracts/configuration-layout.contract';
import type {
  SecretMissing,
  SecretWritten,
  SkillToolUnoffered,
  StationSkillUndefined,
  StationToolUnoffered,
} from '@domain/services/configuration-gaps';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

const unoffered = (verb: string, tool: Tool): string =>
  tool.integration
    ? `${verb} ${tool.value}, which no integration of the team’s offers: add ${tool.name} under tools in ${integrationPath(tool.integration)}`
    : `${verb} ${tool.value}, which Spotlight has no tool by: take it away`;

export const ConfigurationGaps = {
  secretMissing(gap: SecretMissing): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill),
      at: `secrets.${gap.secret.value}`,
      reason: `needs ${gap.secret.value} in ${SECRETS_VAULT} before a run is given it: encrypt it in with the team’s vault key`,
      severity: 'warning',
    });
  },

  secretWritten(gap: SecretWritten): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill),
      at: 'the file',
      reason:
        'writes a secret into what a run reads, and a run is never given one: reach for it through a tool instead',
      severity: 'warning',
    });
  },

  skillToolUnoffered(gap: SkillToolUnoffered): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: skillFile(gap.skill),
      at: `tools.${gap.at}`,
      reason: unoffered('brings', gap.tool),
      severity: 'warning',
    });
  },

  stationToolUnoffered(gap: StationToolUnoffered): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: stationPath(gap.line.value, gap.station.value),
      at: `tools.${gap.at}`,
      reason: unoffered('gives', gap.tool),
      severity: 'warning',
    });
  },

  stationSkillUndefined(gap: StationSkillUndefined): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: stationPath(gap.line.value, gap.station.value),
      at: `skills.${gap.at}`,
      reason: `names ${gap.skill.value}, and the team defines no such skill: add ${skillFile(gap.skill)}, or take it away`,
      severity: 'warning',
    });
  },
};
