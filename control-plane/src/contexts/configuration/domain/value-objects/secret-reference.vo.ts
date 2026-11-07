import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class SecretReference {
  private constructor(
    readonly path: FieldPath,
    readonly name: SecretName,
  ) {}

  static at(path: FieldPath, name: SecretName): SecretReference {
    return new SecretReference(path, name);
  }

  isTo(secret: SecretName): boolean {
    return this.name.equals(secret);
  }

  isToAnyOf(secrets: readonly SecretName[]): boolean {
    return secrets.some((each) => this.isTo(each));
  }
}
