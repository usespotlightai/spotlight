import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';

const PERMISSION_KINDS = ['read', 'edit', 'execute'] as const;

export type PermissionKind = (typeof PERMISSION_KINDS)[number];

export const PERMISSION_DECISIONS = ['allow', 'ask', 'deny'] as const;

export type PermissionDecision = (typeof PERMISSION_DECISIONS)[number];

const SHAPE = /^([a-z]+)(?:\((.*)\))?$/s;

const isKind = (raw: string): raw is PermissionKind =>
  (PERMISSION_KINDS as readonly string[]).includes(raw);

export class PermissionRule {
  private constructor(
    readonly decision: PermissionDecision,
    readonly kind: PermissionKind,
    readonly pattern: string | null,
    readonly at: number,
  ) {}

  static of(
    decision: PermissionDecision,
    raw: string,
    at: number,
  ): PermissionRule {
    const matched = SHAPE.exec(raw.trim());
    const kind = matched?.[1] ?? '';
    const pattern = matched?.[2]?.trim();

    if (!matched || !isKind(kind) || pattern === '') {
      throw new InvalidHarnessProfileError(
        ['permissions', decision, at],
        `permission must be one of ${PERMISSION_KINDS.join(', ')}, optionally with a pattern, such as execute(npm test *)`,
      );
    }

    return new PermissionRule(decision, kind, pattern ?? null, at);
  }

  get written(): string {
    return this.pattern === null ? this.kind : `${this.kind}(${this.pattern})`;
  }

  sameAs(other: PermissionRule): boolean {
    return this.kind === other.kind && this.pattern === other.pattern;
  }
}
