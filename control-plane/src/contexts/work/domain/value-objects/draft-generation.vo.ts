import { InvalidDraftGenerationError } from '@work/domain/exceptions/invalid-draft-generation.error';

export class DraftGeneration {
  private constructor(readonly value: number) {}

  static of(value: number): DraftGeneration {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidDraftGenerationError(value);
    }

    return new DraftGeneration(value);
  }

  static first(): DraftGeneration {
    return new DraftGeneration(0);
  }

  next(): DraftGeneration {
    return new DraftGeneration(this.value + 1);
  }

  equals(other: DraftGeneration): boolean {
    return this.value === other.value;
  }
}
