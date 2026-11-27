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
  // What the link is relative to: the team, as by default, or the workspace, for a notice about the whole workspace.
  readonly linkScope?: 'team' | 'workspace';
  readonly externalLink: {
    readonly url: string;
    readonly label: string;
  } | null;
  readonly headline: string;
  readonly points: readonly string[];
}

export interface NoticesPort {
  create(notice: NoticeOf): Promise<void>;

  resolve(notice: {
    readonly teamId: TeamId;
    readonly form: NoticeFormName;
    readonly subject: string;
  }): Promise<void>;

  // Resolves every notice of the workspace about the subject, whomever it is addressed to.
  resolveEverywhere(notice: {
    readonly workspaceId: WorkspaceId;
    readonly form: NoticeFormName;
    readonly subject: string;
  }): Promise<void>;

  allowsExternalLink(url: string): boolean;
}
