import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class DeferredMove {
  private constructor(readonly to: StationId | null) {}

  static moveTo(to: StationId): DeferredMove {
    return new DeferredMove(to);
  }

  static cleared(): DeferredMove {
    return new DeferredMove(null);
  }

  get clears(): boolean {
    return this.to === null;
  }
}
