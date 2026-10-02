import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ConfigPullRequestId {
  private readonly kind = 'config-pull-request';

  private constructor(readonly value: string) {}

  static of(value: string): ConfigPullRequestId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('config pull request');
    }
    return new ConfigPullRequestId(value);
  }

  equals(other: ConfigPullRequestId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
