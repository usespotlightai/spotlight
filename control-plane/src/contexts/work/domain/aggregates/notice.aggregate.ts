import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import type { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';

const MAX_SUBJECT = 200;

const RESOLVED_SHOWN_FOR_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

interface NoticeState {
  readonly id: NoticeId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly addressee: UserId;
  readonly form: NoticeForm;
  readonly subject: string;
  readonly link: NoticeLink;
  readonly wording: NoticeWording;
  readonly raisedAt: Date;
  readonly resolvedAt: Date | null;
  readonly version: number;
}

export class Notice {
  private constructor(private readonly state: NoticeState) {}

  static raise(input: {
    id: NoticeId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    addressee: UserId;
    form: NoticeForm;
    subject: string;
    link: NoticeLink;
    wording: NoticeWording;
    at: Date;
  }): Notice {
    const subject = input.subject.trim();

    if (!subject || subject.length > MAX_SUBJECT) {
      throw new InvalidNoticeError(
        `subject must be 1 to ${MAX_SUBJECT} characters`,
      );
    }

    return new Notice({
      ...input,
      subject,
      raisedAt: input.at,
      resolvedAt: null,
      version: 0,
    });
  }

  static resolvedShownSince(now: Date): Date {
    return new Date(now.getTime() - RESOLVED_SHOWN_FOR_DAYS * DAY_MS);
  }

  static rehydrate(state: NoticeState): Notice {
    if (state.resolvedAt && state.resolvedAt < state.raisedAt) {
      throw new InconsistentStateError(
        'notice',
        'was resolved before it was raised',
      );
    }

    return new Notice(state);
  }

  get id(): NoticeId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get addressee(): UserId {
    return this.state.addressee;
  }

  get form(): NoticeForm {
    return this.state.form;
  }

  get subject(): string {
    return this.state.subject;
  }

  get link(): NoticeLink {
    return this.state.link;
  }

  get wording(): NoticeWording {
    return this.state.wording;
  }

  get raisedAt(): Date {
    return this.state.raisedAt;
  }

  get resolvedAt(): Date | null {
    return this.state.resolvedAt;
  }

  get version(): number {
    return this.state.version;
  }

  isFor(person: UserId): boolean {
    return this.state.addressee.equals(person);
  }

  resolve(at: Date): Notice {
    return this.state.resolvedAt
      ? this
      : new Notice({ ...this.state, resolvedAt: at });
  }
}
