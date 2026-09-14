import type { Line } from '@domain/aggregates/line.aggregate';
import type { LineKey } from '@domain/value-objects/line-key.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';

export interface RoleClaimedTwice {
  readonly line: LineKey;
  readonly role: LineRole;
  readonly others: readonly LineKey[];
}

interface Claim {
  readonly line: LineKey;
  readonly role: LineRole;
}

export const rolesClaimedTwice = (
  standing: readonly Line[],
  plans: readonly LinePlan[],
): RoleClaimedTwice[] => {
  const planned = (key: LineKey) => plans.some((each) => each.key.equals(key));
  const claims: Claim[] = [
    ...standing.flatMap((line) =>
      line.role && !planned(line.key)
        ? [{ line: line.key, role: line.role }]
        : [],
    ),
    ...plans.flatMap((plan) =>
      plan.role ? [{ line: plan.key, role: plan.role }] : [],
    ),
  ];

  return claims
    .filter((claim) => planned(claim.line))
    .flatMap((claim) => {
      const others = claims
        .filter(
          (other) =>
            other.role.equals(claim.role) && !other.line.equals(claim.line),
        )
        .map((other) => other.line);

      return others.length > 0
        ? [{ line: claim.line, role: claim.role, others }]
        : [];
    });
};
