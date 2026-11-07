import { InvalidDraftGenerationError } from '@work/domain/exceptions/invalid-draft-generation.error';

export class DraftGeneration {
  private constructor(readonly value: number) {}

  static of(value: number): DraftGeneration {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidDraftGenerationError(value);
    }

    return new DraftGeneration(value);
  }

  static sentAs(value: number | null): DraftGeneration | null {
    return value === null ? null : DraftGeneration.of(value);
  }

  static first(): DraftGeneration {
    return new DraftGeneration(0);
  }

  correcting(shown: number): DraftGeneration | null {
    return Number.isInteger(shown) && shown >= this.value ? null : this;
  }

  next(): DraftGeneration {
    return new DraftGeneration(this.value + 1);
  }

  equals(other: DraftGeneration): boolean {
    return this.value === other.value;
  }
}
