import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';

export interface NoticeRepository {
  add(notice: Notice): Promise<void>;

  save(notice: Notice): Promise<void>;

  find(id: NoticeId): Promise<Notice | null>;

  about(
    addressee: UserId,
    form: NoticeForm,
    subject: string,
  ): Promise<Notice | null>;

  forgetTeam(teamId: TeamId): Promise<void>;
}
