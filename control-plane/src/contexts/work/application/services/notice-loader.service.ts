import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import { UnknownNoticeError } from '@work/domain/exceptions/unknown-notice.error';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';

export class NoticeLoader {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly access: WorkAccess,
  ) {}

  async putTo(noticeId: string, slug: string, person: string): Promise<Notice> {
    const viewer = UserId.of(person);
    const notice = await this.notices.find(NoticeId.of(noticeId));
    const team = notice?.isFor(viewer)
      ? await this.access.seenTeam(notice.teamId, viewer)
      : null;

    const unknown = () => new UnknownNoticeError(noticeId);

    if (
      !notice ||
      !team ||
      team.slug !== slug ||
      !team.workspaceId.equals(notice.workspaceId)
    ) {
      throw unknown();
    }

    (await this.access.standingOn(notice.teamId, viewer)).assertActsOnTasks(
      unknown,
    );

    return notice;
  }
}
