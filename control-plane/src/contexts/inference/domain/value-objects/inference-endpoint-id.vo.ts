import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class InferenceEndpointId {
  private readonly kind = 'inference-endpoint';

  private constructor(readonly value: string) {}

  static of(value: string): InferenceEndpointId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('inference endpoint');
    }

    return new InferenceEndpointId(value);
  }

  equals(other: InferenceEndpointId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
