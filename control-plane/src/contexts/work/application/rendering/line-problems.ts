import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { RoleClaimedTwice } from '@work/domain/services/line-roles';
import type { Stranded } from '@work/domain/services/reconcile-line';

export const LineProblems = {
  roleClaimedTwice(
    where: string,
    claim: RoleClaimedTwice,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: where,
      at: 'role',
      reason: `claims the role "${claim.role.value}", which ${claim.others
        .map((each) => each.value)
        .join(', ')} already does, and a role names one line`,
    });
  },

  stranded(where: string, stranded: readonly Stranded[]): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: where,
      at: 'stations',
      reason: `would remove ${stranded
        .map((each) => `${each.name} (${each.tasks} standing there)`)
        .join(', ')}, so nothing here was changed`,
    });
  },

  nowhereToOpen(where: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: where,
      at: 'key',
      reason: 'describes a line this workspace has nowhere to open',
    });
  },

  unapplied(where: string, error: unknown): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: where,
      at: 'stations',
      reason: error instanceof Error ? error.message : String(error),
    });
  },
};
