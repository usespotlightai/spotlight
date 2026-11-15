import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class JudgeDisagreementAnswered implements DomainEvent {
  readonly kind = 'judge-disagreement.answered';

  constructor(
    readonly disagreementId: JudgeDisagreementId,
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly location: RunLocation,
    readonly rubricVersion: RubricVersion,
  ) {}
}
