import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { RoleClaimedTwice } from '@work/domain/services/line-roles';

export const LINES = 'lines';

export const lineAt = (key: string): string => `${LINES}/${key}`;

export const LineProblems = {
  roleClaimedTwice(claim: RoleClaimedTwice): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: lineAt(claim.line.value),
      at: 'role',
      reason: `claims the role "${claim.role.value}", which ${
        claim.others.length > 0
          ? claim.others.map((each) => each.value).join(', ')
          : 'another line'
      } already does, and a role names one line`,
    });
  },

  keyFixed(key: string, because: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: lineAt(key),
      at: 'key',
      reason: because,
    });
  },

  unapplied(key: string, at: string, error: Error): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: lineAt(key),
      at,
      reason: error.message,
    });
  },
};
