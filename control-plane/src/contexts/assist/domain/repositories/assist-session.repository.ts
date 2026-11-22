import type { AssistSession } from '@assist/domain/aggregates/assist-session.aggregate';
import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ASSIST_SESSION_REPOSITORY = Symbol('ASSIST_SESSION_REPOSITORY');

export interface AssistSessionRepository {
  findOrdered(
    workspaceId: WorkspaceId,
    purpose: AssistPurpose,
    key: AssistSessionKey,
  ): Promise<AssistSession | null>;

  findByRun(run: RunId): Promise<AssistSession | null>;

  /** Adds the session, or answers false when one with its workspace, purpose and key exists already. */
  add(session: AssistSession): Promise<boolean>;

  save(session: AssistSession): Promise<void>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly AssistSession[]>;

  /** Removes the session as loaded, or throws when it changed since. */
  remove(session: AssistSession): Promise<void>;
}
