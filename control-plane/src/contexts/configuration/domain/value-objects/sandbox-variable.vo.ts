import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isEnvironmentVariableName } from '@shared-kernel/domain/value-objects/environment-variable-name';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class SandboxVariable {
  private constructor(
    readonly variable: string,
    readonly secret: SecretName,
  ) {}

  static of(variable: string, secret: string): SandboxVariable {
    const at = ['env', variable];

    if (!isEnvironmentVariableName(variable)) {
      throw new InvalidHarnessProfileError(
        at,
        'environment variable names must use letters, digits and underscores',
      );
    }

    try {
      return new SandboxVariable(variable, SecretName.of(secret));
    } catch (error) {
      if (error instanceof InvalidIdentifierError) {
        throw new InvalidHarnessProfileError(
          at,
          `names secret ${secret}, but a secret name ${error.because}`,
        );
      }

      throw error;
    }
  }
}
