import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';

export const NOTICE_REPOSITORY = Symbol('NOTICE_REPOSITORY');

export interface NoticeRepository {
  add(notice: Notice): Promise<void>;

  save(notice: Notice): Promise<void>;

  find(id: NoticeId): Promise<Notice | null>;

  // The notice of a team, or, with no team, the notice of the workspace about the whole workspace, on the subject.
  about(input: {
    readonly workspaceId: WorkspaceId | null;
    readonly teamId: TeamId | null;
    readonly addressee: UserId | null;
    readonly form: NoticeForm;
    readonly subject: NoticeSubject;
  }): Promise<Notice | null>;

  ofTeam(teamId: TeamId): Promise<Notice[]>;

  remove(notice: Notice): Promise<void>;
}
