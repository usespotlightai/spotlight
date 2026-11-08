import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxWatch } from '@work/domain/aggregates/inbox-watch.aggregate';

export const INBOX_WATCH_REPOSITORY = Symbol('INBOX_WATCH_REPOSITORY');

export interface InboxWatchRepository {
  find(workspaceId: WorkspaceId): Promise<InboxWatch | null>;

  nextDueJob(now: Date): Promise<InboxWatch | null>;

  add(watch: InboxWatch): Promise<void>;

  save(watch: InboxWatch): Promise<void>;

  remove(watch: InboxWatch): Promise<void>;
}
