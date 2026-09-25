import { InvalidRepositorySetupError } from '@work/domain/exceptions/invalid-repository-setup.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MOST_SETUP_LENGTH = 500;

export class RepositorySetup {
  private constructor(readonly value: string) {}

  static of(written: string): RepositorySetup {
    return new RepositorySetup(
      WrittenText.oneLine(
        written,
        MOST_SETUP_LENGTH,
        InvalidRepositorySetupError,
      ),
    );
  }

  equals(other: RepositorySetup): boolean {
    return this.value === other.value;
  }
}
