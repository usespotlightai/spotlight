import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkAccess } from '@work/application/services/work-access.service';
import {
  Notice,
  type NoticeStanding,
} from '@work/domain/aggregates/notice.aggregate';
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
    const unknown = () => new UnknownNoticeError(noticeId);

    if (!notice?.isFor(viewer)) {
      throw unknown();
    }

    Notice.assertActedOnBy(
      await this.standingOf(notice, viewer, slug, unknown),
      unknown,
    );

    return notice;
  }

  private async standingOf(
    notice: Notice,
    viewer: UserId,
    slug: string,
    unknown: () => Error,
  ): Promise<NoticeStanding> {
    if (notice.teamId === null) {
      const workspaceId = await this.access.memberWorkspaceAt(slug, viewer);

      if (!workspaceId?.equals(notice.workspaceId)) {
        throw unknown();
      }

      return {
        kind: 'workspace',
        isAdmin: await this.access.isAdminOf(notice.workspaceId, viewer),
      };
    }

    const team = await this.access.seenTeam(notice.teamId, viewer);

    if (
      !team ||
      team.slug !== slug ||
      !team.workspaceId.equals(notice.workspaceId)
    ) {
      throw unknown();
    }

    return {
      kind: 'team',
      team: await this.access.standingOn(notice.teamId, viewer),
    };
  }
}
