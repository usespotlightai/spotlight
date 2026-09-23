export interface ToolUse {
  readonly tool: string;
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

  ofAny(tools: readonly string[]): ToolUses {
    return new ToolUses(this.uses.filter((each) => tools.includes(each.tool)));
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  equals(other: ToolUses): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify(this.uses) === JSON.stringify(other.uses)
    );
  }
}
