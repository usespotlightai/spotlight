import {
  HANDOVER_TO_A_PERSON,
  HANDOVER_TO_FINISH,
} from '@shared-kernel/domain/value-objects/handover-word';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';

interface OfferedStation {
  readonly key: StationKey;
  readonly name: StationName;
}

export class HandoverOption {
  private constructor(
    readonly kind: 'station' | 'review' | 'done',
    readonly station: OfferedStation | null,
  ) {}

  static station(key: StationKey, name: StationName): HandoverOption {
    return new HandoverOption('station', { key, name });
  }

  static review(): HandoverOption {
    return new HandoverOption('review', null);
  }

  static done(): HandoverOption {
    return new HandoverOption('done', null);
  }

  get word(): string {
    return (
      this.station?.key.value ??
      (this.kind === 'done' ? HANDOVER_TO_FINISH : HANDOVER_TO_A_PERSON)
    );
  }

  equals(other: HandoverOption): boolean {
    return (
      this.kind === other.kind &&
      this.word === other.word &&
      (this.station?.name.value ?? null) === (other.station?.name.value ?? null)
    );
  }
}
