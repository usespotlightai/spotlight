import { DONE, REVIEW } from '@domain/value-objects/handover-word';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

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
    return this.station?.key.value ?? (this.kind === 'done' ? DONE : REVIEW);
  }
}
