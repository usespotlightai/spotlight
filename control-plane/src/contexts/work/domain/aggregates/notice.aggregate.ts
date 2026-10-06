import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import type { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';

const MOST_SUBJECT = 200;

const SETTLED_SHOWN_FOR_DAYS = 30;

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
  readonly settledAt: Date | null;
  readonly version: number;
}

export class Notice {
  private constructor(private readonly state: NoticeState) {}

  static raised(input: {
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

    if (!subject || subject.length > MOST_SUBJECT) {
      throw new InvalidNoticeError(
        `subject must be 1 to ${MOST_SUBJECT} characters`,
      );
    }

    return new Notice({
      ...input,
      subject,
      raisedAt: input.at,
      settledAt: null,
      version: 0,
    });
  }

  static settledShownSince(now: Date): Date {
    return new Date(now.getTime() - SETTLED_SHOWN_FOR_DAYS * DAY_MS);
  }

  static rehydrate(state: NoticeState): Notice {
    if (state.settledAt && state.settledAt < state.raisedAt) {
      throw new InconsistentStateError(
        'notice',
        'was settled before it was raised',
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

  get settledAt(): Date | null {
    return this.state.settledAt;
  }

  get version(): number {
    return this.state.version;
  }

  isFor(person: UserId): boolean {
    return this.state.addressee.equals(person);
  }

  settled(at: Date): Notice {
    return this.state.settledAt
      ? this
      : new Notice({ ...this.state, settledAt: at });
  }
}
