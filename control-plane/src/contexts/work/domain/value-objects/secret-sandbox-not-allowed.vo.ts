import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class SecretSandboxNotAllowed implements RefusalReason {
  private constructor(
    readonly station: StationName,
    readonly secret: SecretName,
  ) {}

  static at(station: StationName, secret: SecretName): SecretSandboxNotAllowed {
    return new SecretSandboxNotAllowed(station, secret);
  }

  get description(): string {
    return `secret_sandbox_not_allowed: Secret ${this.secret.value} does not allow its value in a sandbox. Set sandbox = "env" on the secret. Station: ${this.station.value}`;
  }
}
