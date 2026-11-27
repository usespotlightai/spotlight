import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  NoticeFormName,
  NoticeOf,
  NoticesPort,
} from '@work/application/ports/notices.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';

const FORMS: Readonly<Record<NoticeFormName, NoticeForm>> = {
  ended: 'ended',
  advice: 'advice',
};

export class Notices implements NoticesPort {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly access: WorkAccess,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async create(input: NoticeOf): Promise<void> {
    const created = this.noticeOf(input);

    if (!(await this.deliverable(input))) {
      return;
    }

    return this.transaction.inTransaction(async () => {
      if (!(await this.storedLike(created))) {
        await this.notices.add(created);
      }
    });
  }

  async raise(input: NoticeOf): Promise<void> {
    const created = this.noticeOf(input);

    if (!(await this.deliverable(input))) {
      return;
    }

    return this.transaction.inTransaction(async () => {
      const stored = await this.storedLike(created);

      if (!stored) {
        await this.notices.add(created);
      } else if (Notice.reopenable(stored.resolvedAt)) {
        await this.notices.save(stored.reopen(this.clock.now()));
      }
    });
  }

  resolve(input: {
    teamId: TeamId;
    form: NoticeFormName;
    subject: string;
  }): Promise<void> {
    return this.resolved(null, input.teamId, input);
  }

  resolveInWorkspace(input: {
    workspaceId: WorkspaceId;
    form: NoticeFormName;
    subject: string;
  }): Promise<void> {
    return this.resolved(input.workspaceId, null, input);
  }

  private resolved(
    workspaceId: WorkspaceId | null,
    teamId: TeamId | null,
    input: { readonly form: NoticeFormName; readonly subject: string },
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const notice = await this.notices.about({
        workspaceId,
        teamId,
        addressee: null,
        form: FORMS[input.form],
        subject: NoticeSubject.of(input.subject),
      });

      if (notice) {
        await this.notices.save(notice.resolve(this.clock.now()));
      }
    });
  }

  private noticeOf(input: NoticeOf): Notice {
    return Notice.create({
      id: NoticeId.of(this.ids.generate()),
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      addressee: input.addressee,
      form: FORMS[input.form],
      subject: NoticeSubject.of(input.subject),
      link: NoticeLink.of({ path: input.link, label: input.linkLabel }),
      externalLink: input.externalLink
        ? NoticeExternalLink.of(input.externalLink)
        : null,
      wording: NoticeWording.of({
        headline: input.headline,
        points: input.points,
      }),
      at: this.clock.now(),
    });
  }

  private async deliverable(input: NoticeOf): Promise<boolean> {
    const { teamId, addressee } = input;

    return Notice.deliverable({
      aboutWorkspace: teamId === null,
      teamExists:
        teamId !== null && (await this.access.membersOf(teamId)) !== null,
      addressee,
      addresseeSeesTeam:
        teamId !== null && addressee !== null
          ? await this.access.seesTeam(teamId, addressee)
          : false,
    });
  }

  private storedLike(notice: Notice): Promise<Notice | null> {
    return this.notices.about({
      workspaceId: notice.teamId === null ? notice.workspaceId : null,
      teamId: notice.teamId,
      addressee: notice.addressee,
      form: notice.form,
      subject: notice.subject,
    });
  }

  allowsExternalLink(url: string): boolean {
    return NoticeExternalLink.allows(url);
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const notice of await this.notices.ofTeam(teamId)) {
      await this.notices.remove(notice);
    }
  }
}
