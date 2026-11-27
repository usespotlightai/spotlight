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
    const form = FORMS[input.form];
    const created = Notice.create({
      id: NoticeId.of(this.ids.generate()),
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      addressee: input.addressee,
      form,
      subject: NoticeSubject.of(input.subject),
      link: NoticeLink.of({
        path: input.link,
        label: input.linkLabel,
        scope: input.linkScope,
      }),
      externalLink: input.externalLink
        ? NoticeExternalLink.of(input.externalLink)
        : null,
      wording: NoticeWording.of({
        headline: input.headline,
        points: input.points,
      }),
      at: this.clock.now(),
    });

    const addresseeSeesTeam = input.addressee
      ? await this.access.seesTeam(input.teamId, input.addressee)
      : false;

    const teamExists = (await this.access.membersOf(input.teamId)) !== null;

    if (
      !Notice.deliverable({
        teamExists,
        addressee: input.addressee,
        addresseeSeesTeam,
      })
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

  resolve(input: {
    teamId: TeamId;
    form: NoticeFormName;
    subject: string;
  }): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const notice = await this.notices.about(
        input.teamId,
        null,
        FORMS[input.form],
        NoticeSubject.of(input.subject),
      );

      if (notice) {
        await this.notices.save(notice.resolve(this.clock.now()));
      }
    });
  }

  resolveEverywhere(input: {
    workspaceId: WorkspaceId;
    form: NoticeFormName;
    subject: string;
  }): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const at = this.clock.now();

      for (const notice of await this.notices.inWorkspaceAbout(
        input.workspaceId,
        FORMS[input.form],
        NoticeSubject.of(input.subject),
      )) {
        await this.notices.save(notice.resolve(at));
      }
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
