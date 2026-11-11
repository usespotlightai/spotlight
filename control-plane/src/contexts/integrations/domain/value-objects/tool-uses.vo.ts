import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';

export interface ToolUse {
  readonly tool: ToolName;
  readonly by: string;
}

export class ToolUses {
  private readonly kind = 'tool-uses';

  private constructor(readonly uses: readonly ToolUse[]) {}

  static of(uses: readonly ToolUse[]): ToolUses {
    return new ToolUses(uses.map((each) => ({ ...each })));
  }

  static none(): ToolUses {
    return new ToolUses([]);
  }

  ofAny(tools: readonly ToolName[]): ToolUses {
    return new ToolUses(
      this.uses.filter((each) => tools.some((tool) => tool.equals(each.tool))),
    );
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  equals(other: ToolUses): boolean {
    return (
      this.kind === other.kind &&
      this.uses.length === other.uses.length &&
      this.uses.every(
        (each, index) =>
          each.tool.value === other.uses[index]?.tool.value &&
          each.by === other.uses[index]?.by,
      )
    );
  }
}
