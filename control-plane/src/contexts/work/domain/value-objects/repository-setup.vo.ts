import { InvalidRepositorySetupError } from '@work/domain/exceptions/invalid-repository-setup.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MAX_SETUP_LENGTH = 65_536;

export class RepositorySetup {
  private constructor(readonly value: string) {}

  static of(written: string): RepositorySetup {
    return new RepositorySetup(
      WrittenText.of(written, MAX_SETUP_LENGTH, InvalidRepositorySetupError),
    );
  }

  equals(other: RepositorySetup): boolean {
    return this.value === other.value;
  }
}
