import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { NoticeVersionConflictError } from '@work/domain/exceptions/notice-version-conflict.error';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { notice } from '@work/infrastructure/persistence/drizzle/schemas/notice.schema';
import { and, eq, isNull } from 'drizzle-orm';

type Row = typeof notice.$inferSelect;

const toNotice = (row: Row): Notice =>
  Notice.rehydrate({
    id: NoticeId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    addressee: row.addresseeId === null ? null : UserId.of(row.addresseeId),
    form: row.form,
    subject: row.subject,
    link: NoticeLink.of({ path: row.link, label: row.linkLabel }),
    wording: NoticeWording.of({ headline: row.headline, points: row.points }),
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleNoticeRepository implements NoticeRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Notice): Promise<void> {
    await this.context.db.insert(notice).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      teamId: added.teamId.value,
      addresseeId: added.addressee?.value ?? null,
      form: added.form,
      subject: added.subject,
      link: added.link.path,
      linkLabel: added.link.label,
      headline: added.wording.headline,
      points: [...added.wording.points],
      createdAt: added.createdAt,
      resolvedAt: added.resolvedAt,
      version: added.version,
    });
  }

  async save(saved: Notice): Promise<void> {
    const written = await this.context.db
      .update(notice)
      .set({
        resolvedAt: saved.resolvedAt,
        version: saved.version + 1,
      })
      .where(
        and(eq(notice.id, saved.id.value), eq(notice.version, saved.version)),
      )
      .returning({ id: notice.id });

    if (written.length === 0) {
      throw new NoticeVersionConflictError(saved.id.value);
    }
  }

  async find(id: NoticeId): Promise<Notice | null> {
    const [row] = await this.context.db
      .select()
      .from(notice)
      .where(eq(notice.id, id.value))
      .limit(1);

    return row ? toNotice(row) : null;
  }

  async about(
    teamId: TeamId,
    addressee: UserId | null,
    form: NoticeForm,
    subject: string,
  ): Promise<Notice | null> {
    const [row] = await this.context.db
      .select()
      .from(notice)
      .where(
        and(
          eq(notice.teamId, teamId.value),
          addressee === null
            ? isNull(notice.addresseeId)
            : eq(notice.addresseeId, addressee.value),
          eq(notice.form, form),
          eq(notice.subject, subject),
        ),
      )
      .limit(1);

    return row ? toNotice(row) : null;
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.context.db.delete(notice).where(eq(notice.teamId, teamId.value));
  }
}
