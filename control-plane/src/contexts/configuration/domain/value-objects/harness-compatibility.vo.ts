import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export interface HarnessIncompatibility {
  readonly at: FieldPath;
  readonly reason: string;
}

export class HarnessCompatibility {
  private constructor(
    readonly incompatibilities: readonly HarnessIncompatibility[],
  ) {}

  static of(
    incompatibilities: readonly HarnessIncompatibility[],
  ): HarnessCompatibility {
    return new HarnessCompatibility([...incompatibilities]);
  }

  get isCompatible(): boolean {
    return this.incompatibilities.length === 0;
  }
}
