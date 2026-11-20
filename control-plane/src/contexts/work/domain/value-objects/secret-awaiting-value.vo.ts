import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class SecretAwaitingValue implements RefusalReason {
  private constructor(
    readonly station: StationName,
    readonly secret: SecretName,
  ) {}

  static at(station: StationName, secret: SecretName): SecretAwaitingValue {
    return new SecretAwaitingValue(station, secret);
  }

  get description(): string {
    return `secret_awaiting_value: Secret ${this.secret.value} has no value. Station: ${this.station.value}`;
  }
}
