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

  async create(input: NoticeOf): Promise<void> {
    const form = noticeForm(input.form);
    const created = Notice.create({
      id: NoticeId.of(this.ids.generate()),
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      addressee: input.addressee,
      form,
      subject: input.subject,
      link: NoticeLink.of({ path: input.link, label: input.linkLabel }),
      wording: NoticeWording.of({
        headline: input.headline,
        points: input.points,
      }),
      at: this.clock.now(),
    });

    if (
      input.addressee !== null &&
      !(await this.access.onTeam(input.teamId.value, input.addressee))
    ) {
      return;
    }

    return this.transaction.inTransaction(async () => {
      if (
        !(await this.notices.about(
          created.teamId,
          created.addressee,
          form,
          created.subject,
        ))
      ) {
        await this.notices.add(created);
      }
    });
  }

  deleteForTeam(teamId: TeamId): Promise<void> {
    return this.notices.deleteForTeam(teamId);
  }
}
