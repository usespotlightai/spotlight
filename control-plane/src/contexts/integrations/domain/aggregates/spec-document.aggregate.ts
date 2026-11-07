import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { repeatedIn } from '@shared-kernel/domain/distinct';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

interface State {
  readonly hash: ContentHash;
  readonly kind: ApiSpecKind;
  readonly operations: readonly SpecOperation[];
  readonly skipped: readonly string[];
  readonly readAt: Date;
}

interface Stored extends State {
  readonly version: number;
}

const guardDistinct = (input: State): void => {
  const twice = repeatedIn(input.operations.map((each) => each.name));

  if (twice) {
    throw new InvalidIntegrationPartError(
      input.kind,
      `was read with two operations called ${twice}`,
    );
  }
};

export class SpecDocument {
  private constructor(private readonly state: Stored) {}

  static read(input: State): SpecDocument {
    guardDistinct(input);

    return new SpecDocument({
      ...input,
      operations: [...input.operations],
      skipped: [...input.skipped],
      version: 0,
    });
  }

  static rehydrate(input: Stored): SpecDocument {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'spec document',
        `has an impossible version (${input.version})`,
      );
    }

    guardDistinct(input);

    return new SpecDocument(input);
  }

  get hash(): ContentHash {
    return this.state.hash;
  }

  get kind(): ApiSpecKind {
    return this.state.kind;
  }

  get operations(): readonly SpecOperation[] {
    return this.state.operations;
  }

  get skipped(): readonly string[] {
    return this.state.skipped;
  }

  get readAt(): Date {
    return this.state.readAt;
  }

  get version(): number {
    return this.state.version;
  }

  operation(name: string): SpecOperation | null {
    return this.state.operations.find((each) => each.name === name) ?? null;
  }

  equals(other: SpecDocument): boolean {
    return this.hash.equals(other.hash);
  }
}
