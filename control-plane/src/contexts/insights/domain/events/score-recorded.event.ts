import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreSource } from '@insights/domain/value-objects/score-source';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ScoreRecorded implements DomainEvent {
  readonly kind = 'score.recorded';

  constructor(
    readonly scoreId: ScoreId,
    readonly runId: RunId,
    readonly location: RunLocation,
    readonly source: ScoreSource,
  ) {}
}
