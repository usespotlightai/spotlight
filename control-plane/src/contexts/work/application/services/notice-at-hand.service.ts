import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import { UnknownNoticeError } from '@work/domain/exceptions/unknown-notice.error';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';

export class NoticeAtHand {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async putTo(noticeId: string, slug: string, person: string): Promise<Notice> {
    const viewer = UserId.of(person);
    const notice = await this.notices.find(NoticeId.of(noticeId));
    const membership = notice?.isFor(viewer)
      ? await this.access.onTeam(notice.teamId.value, viewer)
      : null;

    if (
      !notice ||
      !membership ||
      membership.slug !== slug ||
      !membership.workspaceId.equals(notice.workspaceId)
    ) {
      throw new UnknownNoticeError(noticeId);
    }

    return notice;
  }
}
