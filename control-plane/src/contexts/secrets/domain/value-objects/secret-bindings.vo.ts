import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretBinding } from '@secrets/domain/value-objects/secret-binding.vo';

const MOST = 32;

const FIELD = 'bindings';

export class SecretBindings {
  private constructor(readonly all: readonly SecretBinding[]) {}

  static none(): SecretBindings {
    return new SecretBindings([]);
  }

  static of(
    inputs: readonly {
      host: string;
      location?: string | null;
      name?: string | null;
      prefix?: string | null;
    }[],
  ): SecretBindings {
    if (inputs.length > MOST) {
      throw new InvalidSecretError(FIELD, `must name at most ${MOST} hosts`);
    }

    const bindings = inputs.map((input, at) => {
      try {
        return SecretBinding.of(input);
      } catch (error) {
        if (error instanceof InvalidSecretError) {
          throw new InvalidSecretError(
            [FIELD, at, ...error.field.segments],
            error.because,
          );
        }

        throw error;
      }
    });

    bindings.forEach((binding, at) => {
      if (bindings.slice(0, at).some((each) => each.host === binding.host)) {
        throw new InvalidSecretError(
          [FIELD, at, 'host'],
          `binds ${binding.host} more than once`,
        );
      }
    });

    return new SecretBindings(bindings);
  }

  forUrl(url: URL): SecretBinding | null {
    return this.all.find((each) => each.matches(url)) ?? null;
  }

  on(host: string): SecretBinding | null {
    return this.all.find((each) => each.host === host) ?? null;
  }

  get hosts(): readonly string[] {
    return this.all.map((each) => each.host);
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  equals(other: SecretBindings): boolean {
    return (
      this.all.length === other.all.length &&
      this.all.every((each, at) => {
        const theirs = other.all[at];
        return theirs !== undefined && each.equals(theirs);
      })
    );
  }
}
