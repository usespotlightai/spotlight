import type { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionDisputed implements DomainEvent {
  readonly kind = 'decisions.disputed';

  constructor(
    readonly setId: DecisionSetId,
    readonly taskId: TaskId,
    readonly decisionId: DecisionId,
    readonly path: FilePath,
  ) {}
}
