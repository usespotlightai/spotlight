import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import type { RoleClaimedTwice } from '@domain/services/line-roles';
import type { Stranded } from '@domain/services/reconcile-line';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { LineKey } from '@domain/value-objects/line-key.vo';

export const LineProblems = {
  roleClaimedTwice(claim: RoleClaimedTwice): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: linePath(claim.line.value),
      at: 'role',
      reason: `claims the role "${claim.role.value}", which ${claim.others
        .map((each) => each.value)
        .join(', ')} already does, and a role names one line`,
    });
  },

  stranded(line: LineKey, stranded: readonly Stranded[]): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: linePath(line.value),
      at: 'stations',
      reason: `would remove ${stranded
        .map((each) => `${each.name} (${each.tasks} standing there)`)
        .join(', ')}, so nothing here was changed`,
    });
  },

  nowhereToOpen(line: LineKey): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: linePath(line.value),
      at: 'key',
      reason: 'describes a line this workspace has nowhere to open',
    });
  },

  unapplied(line: LineKey, error: unknown): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: linePath(line.value),
      at: 'stations',
      reason: error instanceof Error ? error.message : String(error),
    });
  },
};
