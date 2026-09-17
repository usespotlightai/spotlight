import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';

export class LineRepositoriesChanged implements DomainEvent {
  readonly kind = 'line.repositories-changed';

  constructor(
    readonly lineId: LineId,
    readonly repositories: LineRepositories,
  ) {}
}
