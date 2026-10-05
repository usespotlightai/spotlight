import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const TOOL_RULES = ['allowed', 'needs-approval', 'blocked'] as const;

export type ToolRuleName = (typeof TOOL_RULES)[number];

const isRule = (name: string): name is ToolRuleName =>
  (TOOL_RULES as readonly string[]).includes(name);

export class ToolRule {
  private constructor(readonly name: ToolRuleName) {}

  static of(name: string): ToolRule {
    if (!isRule(name)) {
      throw new InconsistentStateError(
        'tool rule',
        `was ${JSON.stringify(name)}, not one of ${TOOL_RULES.join(', ')}`,
      );
    }

    return new ToolRule(name);
  }

  get blocks(): boolean {
    return this.name === 'blocked';
  }

  get asksFirst(): boolean {
    return this.name === 'needs-approval';
  }

  equals(other: ToolRule): boolean {
    return this.name === other.name;
  }
}
