import { planOf, written } from '@work/domain/services/permission-plan';
import type {
  PermissionDecision,
  PermissionKind,
} from '@work/domain/value-objects/ready-profile';
import { describe, expect, it } from 'vitest';

const rule = (
  decision: PermissionDecision,
  kind: PermissionKind,
  pattern: string | null = null,
) => ({ decision, kind, pattern, at: 0 });

const planFor = (kind: PermissionKind, rules: ReturnType<typeof rule>[]) =>
  planOf(rules).find((each) => each.kind === kind);

describe('a permission plan', () => {
  it('allows every kind no rule names', () => {
    expect(planOf([]).map((each) => each.otherwise)).toEqual([
      'allow',
      'allow',
      'allow',
    ]);
  });

  it('lets the strictest bare rule of a kind decide the rest of it', () => {
    const plan = planFor('execute', [
      rule('allow', 'execute'),
      rule('deny', 'execute'),
      rule('ask', 'execute'),
    ]);

    expect(plan?.otherwise).toBe('deny');
    expect(plan?.bare?.decision).toBe('deny');
  });

  it('keeps rules with a pattern as exceptions to their own kind', () => {
    const push = rule('ask', 'execute', 'git push *');

    expect(planFor('execute', [push, rule('deny', 'read')])).toEqual({
      kind: 'execute',
      otherwise: 'allow',
      bare: null,
      exceptions: [push],
    });
  });

  it('writes a rule as it was given', () => {
    expect(written(rule('deny', 'read', '.env'))).toBe('read(.env)');
    expect(written(rule('ask', 'edit'))).toBe('edit');
  });
});
