import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import type { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { AssistOutcome } from '@assist/domain/value-objects/assist-state.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

/** The session stopped waiting: its result counts now, or it failed. */
export class AssistSessionSettled implements DomainEvent {
  readonly kind = 'assist.session-settled';

  constructor(
    readonly sessionId: AssistSessionId,
    readonly workspaceId: WorkspaceId,
    readonly purpose: AssistPurpose,
    readonly key: AssistSessionKey,
    readonly outcome: AssistOutcome,
  ) {}
}
