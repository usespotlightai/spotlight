import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  NoticeOf,
  NoticesPort,
} from '@work/application/ports/notices.port';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { noticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';

export class Notices implements NoticesPort {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async raise(asked: NoticeOf): Promise<void> {
    const form = noticeForm(asked.form);
    const raised = Notice.raised({
      id: NoticeId.of(this.ids.generate()),
      workspaceId: asked.workspaceId,
      teamId: asked.teamId,
      addressee: asked.addressee,
      form,
      subject: asked.subject,
      link: NoticeLink.of({ path: asked.link, label: asked.linkLabel }),
      wording: NoticeWording.of({
        headline: asked.headline,
        points: asked.points,
      }),
      at: this.clock.now(),
    });

    if (!(await this.access.onTeam(asked.teamId.value, asked.addressee))) {
      return;
    }

    return this.transaction.run(async () => {
      if (!(await this.notices.about(raised.addressee, form, raised.subject))) {
        await this.notices.add(raised);
      }
    });
  }

  forgetTeam(teamId: TeamId): Promise<void> {
    return this.notices.forgetTeam(teamId);
  }
}
