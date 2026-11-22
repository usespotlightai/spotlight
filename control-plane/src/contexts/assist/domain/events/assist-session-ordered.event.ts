import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import type { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

/** A session was ordered; assist queues its run in reaction, with the briefing and files it carries. */
export class AssistSessionOrdered implements DomainEvent {
  readonly kind = 'assist.session-ordered';

  constructor(
    readonly sessionId: AssistSessionId,
    readonly workspaceId: WorkspaceId,
    readonly purpose: AssistPurpose,
    readonly key: AssistSessionKey,
    readonly basedOn: RunId,
    readonly run: RunId,
    readonly briefing: string,
    readonly files: Readonly<Record<string, string>>,
  ) {}
}
