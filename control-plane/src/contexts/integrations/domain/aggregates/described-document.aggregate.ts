import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedKind } from '@integrations/domain/value-objects/described-source.vo';
import { repeatedIn } from '@shared-kernel/domain/services/distinct';

interface State {
  readonly hash: ContentHash;
  readonly kind: DescribedKind;
  readonly operations: readonly DescribedOperation[];
  readonly passedOver: readonly string[];
  readonly readAt: Date;
}

export class DescribedDocument {
  private constructor(private readonly state: State) {}

  static read(input: State): DescribedDocument {
    const twice = repeatedIn(input.operations.map((each) => each.name));

    if (twice) {
      throw new InvalidIntegrationPartError(
        input.kind,
        `was read with two operations called ${twice}`,
      );
    }

    return new DescribedDocument({
      ...input,
      operations: [...input.operations],
      passedOver: [...input.passedOver],
    });
  }

  static rehydrate(input: State): DescribedDocument {
    return new DescribedDocument(input);
  }

  get hash(): ContentHash {
    return this.state.hash;
  }

  get kind(): DescribedKind {
    return this.state.kind;
  }

  get operations(): readonly DescribedOperation[] {
    return this.state.operations;
  }

  get passedOver(): readonly string[] {
    return this.state.passedOver;
  }

  get readAt(): Date {
    return this.state.readAt;
  }

  operation(name: string): DescribedOperation | null {
    return this.state.operations.find((each) => each.name === name) ?? null;
  }

  equals(other: DescribedDocument): boolean {
    return this.hash.equals(other.hash);
  }
}
