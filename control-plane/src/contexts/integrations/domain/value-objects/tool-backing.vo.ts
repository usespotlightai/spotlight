import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';

export class ToolBacking {
  private constructor(
    readonly action: string | null,
    readonly spec: {
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
    return this.spec !== null;
  }

  equals(other: ToolBacking): boolean {
    return (
      this.action === other.action &&
      this.spec?.operation === other.spec?.operation &&
      (this.spec === null ||
        other.spec === null ||
        this.spec.hash.equals(other.spec.hash))
    );
  }
}
