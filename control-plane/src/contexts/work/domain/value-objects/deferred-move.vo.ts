import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class DeferredMove {
  private constructor(readonly to: StationId) {}

  static moveTo(to: StationId): DeferredMove {
    return new DeferredMove(to);
  }

  equals(other: DeferredMove): boolean {
    return this.to.equals(other.to);
  }
}
