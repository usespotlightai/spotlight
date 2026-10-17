import { InvalidRunnerImageError } from '@shared-kernel/domain/exceptions/invalid-runner-image.error';

const MAX_LENGTH = 255;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const REFERENCE =
  /^[a-z0-9]+([._-][a-z0-9]+)*(:[0-9]+)?(\/[a-z0-9]+([._-][a-z0-9]+)*)*(:[A-Za-z0-9_][A-Za-z0-9._-]{0,127})?(@sha256:[0-9a-f]{64})?$/;

export class RunnerImage {
  private constructor(readonly value: string) {}

  static of(raw: string): RunnerImage {
    const reference = raw.trim();

    if (!reference || reference.length > MAX_LENGTH) {
      throw new InvalidRunnerImageError(
        `reference must be at most ${MAX_LENGTH} characters`,
      );
    }

    if (!REFERENCE.test(reference)) {
      throw new InvalidRunnerImageError(
        'must be a lowercase reference with an optional tag or digest, such as ghcr.io/acme/runner:main',
      );
    }

    return new RunnerImage(reference);
  }

  get isPinned(): boolean {
    return DIGEST.test(this.value);
  }

  get repository(): string {
    const [named = ''] = this.value.split('@');
    const slash = named.lastIndexOf('/');
    const colon = named.lastIndexOf(':');
    const untagged = colon > slash ? named.slice(0, colon) : named;

    return untagged.replace(/^docker\.io\//, '').replace(/^library\//, '');
  }

  equals(other: RunnerImage): boolean {
    return this.value === other.value;
  }
}
