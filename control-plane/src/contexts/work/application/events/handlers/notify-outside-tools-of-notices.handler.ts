import type { NoticeFormName } from '@work/application/ports/notices.port';
import type { TeamNoticesPort } from '@work/application/ports/team-notices.port';
import type { NoticeRaised } from '@work/domain/events/notice-raised.event';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';

const FORMS: Readonly<Record<NoticeForm, NoticeFormName>> = {
  ended: 'ended',
  advice: 'advice',
};

export class NotifyOutsideToolsOfNotices {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly outside: TeamNoticesPort,
  ) {}

  async on(event: NoticeRaised): Promise<void> {
    const notice = await this.notices.find(event.noticeId);

    if (!notice?.openToTeam) {
      return;
    }

    await this.outside.notify({
      id: notice.id.value,
      workspaceId: notice.workspaceId.value,
      teamId: notice.teamId.value,
      form: FORMS[notice.form],
      headline: notice.wording.headline,
      points: notice.wording.points,
      externalLink: notice.externalLink
        ? { url: notice.externalLink.url, label: notice.externalLink.label }
        : null,
    });
  }
}
