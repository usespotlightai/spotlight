import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NoticeRaised } from '@work/domain/events/notice-raised.event';
import type { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import type { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import type { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';

interface NoticeState {
  readonly id: NoticeId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly addressee: UserId | null;
  readonly form: NoticeForm;
  readonly subject: NoticeSubject;
  readonly link: NoticeLink;
  readonly externalLink: NoticeExternalLink | null;
  readonly wording: NoticeWording;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly version: number;
}

export interface NoticeAudience {
  readonly addressee: UserId;
  readonly unaddressed: boolean;
}

export class Notice extends EventRecorder {
  private constructor(private readonly state: NoticeState) {
    super();
  }

  static create(input: {
    id: NoticeId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    addressee: UserId | null;
    form: NoticeForm;
    subject: NoticeSubject;
    link: NoticeLink;
    externalLink: NoticeExternalLink | null;
    wording: NoticeWording;
    at: Date;
  }): Notice {
    const created = new Notice({
      ...input,
      createdAt: input.at,
      resolvedAt: null,
      version: 0,
    });
    created.raised(input.at);

    return created;
  }

  static deliverable(
    addressee: UserId | null,
    addresseeSeesTeam: boolean,
  ): boolean {
    return addressee === null || addresseeSeesTeam;
  }

  static reopenable(resolvedAt: Date | null): boolean {
    return resolvedAt !== null;
  }

  static unread(resolvedAt: Date | null): boolean {
    return resolvedAt === null;
  }

  static rehydrate(state: NoticeState): Notice {
    if (state.version < 0) {
      throw new InconsistentStateError('notice', 'has a negative version');
    }

    if (state.resolvedAt && state.resolvedAt < state.createdAt) {
      throw new InconsistentStateError(
        'notice',
        'was resolved before it was created',
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

  get addressee(): UserId | null {
    return this.state.addressee;
  }

  get form(): NoticeForm {
    return this.state.form;
  }

  get subject(): NoticeSubject {
    return this.state.subject;
  }

  get link(): NoticeLink {
    return this.state.link;
  }

  get externalLink(): NoticeExternalLink | null {
    return this.state.externalLink;
  }

  get wording(): NoticeWording {
    return this.state.wording;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get resolvedAt(): Date | null {
    return this.state.resolvedAt;
  }

  get version(): number {
    return this.state.version;
  }

  static audienceOf(person: UserId): NoticeAudience {
    return { addressee: person, unaddressed: true };
  }

  static addressedTo(addressee: UserId | null, person: UserId): boolean {
    const audience = Notice.audienceOf(person);

    return addressee
      ? addressee.equals(audience.addressee)
      : audience.unaddressed;
  }

  isFor(person: UserId): boolean {
    return Notice.addressedTo(this.state.addressee, person);
  }

  resolve(at: Date): Notice {
    if (this.state.resolvedAt) {
      return this;
    }

    const resolved = new Notice({ ...this.state, resolvedAt: at });
    resolved.inheritEvents(this);

    return resolved;
  }

  reopen(at: Date): Notice {
    if (!Notice.reopenable(this.state.resolvedAt)) {
      return this;
    }

    const reopened = new Notice({ ...this.state, resolvedAt: null });
    reopened.inheritEvents(this);
    reopened.raised(at);

    return reopened;
  }

  private raised(at: Date): void {
    this.record(
      new NoticeRaised(
        this.state.id,
        this.state.workspaceId,
        this.state.teamId,
        this.state.addressee,
        at,
      ),
    );
  }
}
