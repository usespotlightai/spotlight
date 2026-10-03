import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const NOTICES = Symbol('NOTICES');

export interface NoticeOf {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly addressee: UserId;
  readonly form: string;
  readonly subject: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly headline: string;
  readonly points: readonly string[];
}

export interface NoticesPort {
  raise(notice: NoticeOf): Promise<void>;
}
