import {
  PERMISSION_KINDS,
  type PermissionDecision,
  type PermissionKind,
  type PermissionRuleParts,
} from '@work/domain/value-objects/ready-profile';

const STRICTNESS: Readonly<Record<PermissionDecision, number>> = {
  allow: 0,
  ask: 1,
  deny: 2,
};

export const stricter = (
  a: PermissionDecision,
  b: PermissionDecision,
): boolean => STRICTNESS[a] > STRICTNESS[b];

export interface KindPlan {
  readonly kind: PermissionKind;
  readonly otherwise: PermissionDecision;
  readonly bare: PermissionRuleParts | null;
  readonly exceptions: readonly PermissionRuleParts[];
}

export const planOf = (
  rules: readonly PermissionRuleParts[],
): readonly KindPlan[] =>
  PERMISSION_KINDS.map((kind) => {
    const bare =
      rules
        .filter((each) => each.kind === kind && each.pattern === null)
        .reduce<PermissionRuleParts | null>(
          (held, each) =>
            !held || stricter(each.decision, held.decision) ? each : held,
          null,
        ) ?? null;

    return {
      kind,
      otherwise: bare?.decision ?? 'allow',
      bare,
      exceptions: rules.filter(
        (each) => each.kind === kind && each.pattern !== null,
      ),
    };
  });

export const written = (rule: PermissionRuleParts): string =>
  rule.pattern === null ? rule.kind : `${rule.kind}(${rule.pattern})`;
