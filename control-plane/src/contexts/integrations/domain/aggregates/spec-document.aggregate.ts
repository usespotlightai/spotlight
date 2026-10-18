import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { repeatedIn } from '@shared-kernel/domain/services/distinct';

interface State {
  readonly hash: ContentHash;
  readonly kind: ApiSpecKind;
  readonly operations: readonly SpecOperation[];
  readonly skipped: readonly string[];
  readonly readAt: Date;
}

export class SpecDocument {
  private constructor(private readonly state: State) {}

  static read(input: State): SpecDocument {
    const twice = repeatedIn(input.operations.map((each) => each.name));

    if (twice) {
      throw new InvalidIntegrationPartError(
        input.kind,
        `was read with two operations called ${twice}`,
      );
    }

    return new SpecDocument({
      ...input,
      operations: [...input.operations],
      skipped: [...input.skipped],
    });
  }

  static rehydrate(input: State): SpecDocument {
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

  operation(name: string): SpecOperation | null {
    return this.state.operations.find((each) => each.name === name) ?? null;
  }

  equals(other: SpecDocument): boolean {
    return this.hash.equals(other.hash);
  }
}
