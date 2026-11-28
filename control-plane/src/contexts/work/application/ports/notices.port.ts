import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const NOTICES = Symbol('NOTICES');

const NOTICE_FORMS = ['ended', 'advice'] as const;

export type NoticeFormName = (typeof NOTICE_FORMS)[number];

export interface NoticeOf {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly addressee: UserId | null;
  readonly form: NoticeFormName;
  readonly subject: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly externalLink: {
    readonly url: string;
    readonly label: string;
  } | null;
  readonly headline: string;
  readonly points: readonly string[];
}

// A notice about the whole workspace, for its owners and admins: it has no team and no addressee. With autoResolve, Spotlight resolves it once its cause ends, and no person resolves or reopens it.
export interface WorkspaceNoticeOf extends Omit<
  NoticeOf,
  'teamId' | 'addressee'
> {
  readonly autoResolve: boolean;
}

export interface NoticesPort {
  create(notice: NoticeOf): Promise<void>;

  resolve(notice: {
    readonly teamId: TeamId;
    readonly form: NoticeFormName;
    readonly subject: string;
  }): Promise<void>;

  allowsExternalLink(url: string): boolean;
}
