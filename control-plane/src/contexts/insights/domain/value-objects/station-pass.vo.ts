import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class StationPass {
  private constructor(
    readonly to: StationId,
    readonly at: Date,
  ) {}

  static of(to: StationId, at: Date): StationPass {
    return new StationPass(to, at);
  }
}
