import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';

export const NOTICE_REPOSITORY = Symbol('NOTICE_REPOSITORY');

export interface NoticeRepository {
  add(notice: Notice): Promise<void>;

  save(notice: Notice): Promise<void>;

  find(id: NoticeId): Promise<Notice | null>;

  about(
    teamId: TeamId,
    addressee: UserId | null,
    form: NoticeForm,
    subject: NoticeSubject,
  ): Promise<Notice | null>;

  ofTeam(teamId: TeamId): Promise<Notice[]>;

  remove(notice: Notice): Promise<void>;
}
