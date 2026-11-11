import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import type { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class StateChangeDetail implements ChangeDetail {
  private constructor(private readonly detail: RecordedDetail) {}

  static written(version: StateVersion): StateChangeDetail {
    return new StateChangeDetail({
      version: version.number,
      serial: version.snapshot.serial,
      lineage: version.snapshot.lineage,
    });
  }

  static released(lock: StateLock, forced: boolean): StateChangeDetail {
    return new StateChangeDetail({
      released: forced ? 'forced' : 'held-by-another',
      lock: lock.id.value,
      heldBy: lock.lockedBy.value,
      operation: lock.operation,
    });
  }

  recorded(): RecordedDetail {
    return this.detail;
  }
}
