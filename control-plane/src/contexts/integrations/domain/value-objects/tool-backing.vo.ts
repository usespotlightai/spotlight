import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';

export class ToolBacking {
  private constructor(
    readonly action: string | null,
    readonly described: {
      readonly hash: ContentHash;
      readonly operation: string;
    } | null,
  ) {}

  static action(action: string): ToolBacking {
    return new ToolBacking(action, null);
  }

  static operation(hash: ContentHash, operation: string): ToolBacking {
    return new ToolBacking(null, { hash, operation });
  }

  get isGenerated(): boolean {
    return this.described !== null;
  }

  equals(other: ToolBacking): boolean {
    return (
      this.action === other.action &&
      this.described?.operation === other.described?.operation &&
      (this.described === null ||
        other.described === null ||
        this.described.hash.equals(other.described.hash))
    );
  }
}
