import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NoticeRaised } from '@work/domain/events/notice-raised.event';
import { NoticeReopened } from '@work/domain/events/notice-reopened.event';
import { NoticeResolved } from '@work/domain/events/notice-resolved.event';
import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';
import type { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import type { NoticeForm } from '@work/domain/value-objects/notice-form';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import type { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import type { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import type { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

interface NoticeState {
  readonly id: NoticeId;
  readonly workspaceId: WorkspaceId;
  // Null for a notice about the whole workspace: it goes to the owners and admins of the workspace, and to no team.
  readonly teamId: TeamId | null;
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

// How a person stands to a notice: on the team of a team notice, or as an admin or not of the workspace, for a notice about the whole workspace.
export type NoticeStanding =
  | { readonly kind: 'team'; readonly team: TeamStanding }
  | { readonly kind: 'workspace'; readonly isAdmin: boolean };

// A notice about the whole workspace has no addressee: every owner and admin gets it.
const checkedAudience = (
  teamId: TeamId | null,
  addressee: UserId | null,
): void => {
  if (teamId === null && addressee !== null) {
    throw new InvalidNoticeError(
      'about the whole workspace goes to its admins, not to one person',
    );
  }
};

export class Notice extends EventRecorder {
  private constructor(private readonly state: NoticeState) {
    super();
  }

  static create(input: {
    id: NoticeId;
    workspaceId: WorkspaceId;
    teamId: TeamId | null;
    addressee: UserId | null;
    form: NoticeForm;
    subject: NoticeSubject;
    link: NoticeLink;
    externalLink: NoticeExternalLink | null;
    wording: NoticeWording;
    at: Date;
  }): Notice {
    checkedAudience(input.teamId, input.addressee);

    const created = new Notice({
      ...input,
      createdAt: input.at,
      resolvedAt: null,
      version: 0,
    });
    created.record(
      new NoticeRaised(
        created.state.id,
        created.state.workspaceId,
        created.state.teamId,
        created.state.addressee,
        input.at,
      ),
    );

    return created;
  }

  // A notice about the whole workspace always reaches its admins. A team notice needs its team, and its addressee on it.
  static deliverable(input: {
    aboutWorkspace: boolean;
    teamExists: boolean;
    addressee: UserId | null;
    addresseeSeesTeam: boolean;
  }): boolean {
    return (
      input.aboutWorkspace ||
      (input.teamExists &&
        (input.addressee === null || input.addresseeSeesTeam))
    );
  }

  static reopenable(resolvedAt: Date | null): boolean {
    return resolvedAt !== null;
  }

  // A person acts on a team notice who acts on the tasks of its team, and on a notice about the whole workspace who is an owner or admin of it.
  static assertActedOnBy(standing: NoticeStanding, unseen: () => Error): void {
    if (standing.kind === 'team') {
      standing.team.assertActsOnTasks(unseen);
    } else if (!standing.isAdmin) {
      throw unseen();
    }
  }

  private static actsOn(standing: NoticeStanding): boolean {
    return standing.kind === 'team'
      ? standing.team.actsOnTasks
      : standing.isAdmin;
  }

  static resolvableBy(
    standing: NoticeStanding,
    resolvedAt: Date | null,
  ): boolean {
    return Notice.actsOn(standing) && resolvedAt === null;
  }

  static reopenableBy(
    standing: NoticeStanding,
    resolvedAt: Date | null,
  ): boolean {
    return Notice.actsOn(standing) && Notice.reopenable(resolvedAt);
  }

  // A person's inbox shows a team notice addressed to them, or to the team, of a team they see, and a notice about the whole workspace to its owners and admins.
  static shownTo(input: {
    readonly teamId: string | null;
    readonly addressee: UserId | null;
    readonly person: UserId;
    readonly teamsSeen: ReadonlySet<string>;
    readonly isAdmin: boolean;
  }): boolean {
    return input.teamId === null
      ? input.isAdmin
      : input.teamsSeen.has(input.teamId) &&
          Notice.addressedTo(input.addressee, input.person);
  }

  static unread(resolvedAt: Date | null): boolean {
    return resolvedAt === null;
  }

  static rehydrate(state: NoticeState): Notice {
    if (state.teamId === null && state.addressee !== null) {
      throw new InconsistentStateError(
        'notice',
        'is about the whole workspace but has an addressee',
      );
    }

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

  get teamId(): TeamId | null {
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

  get openToTeam(): boolean {
    return (
      this.state.teamId !== null &&
      this.state.addressee === null &&
      Notice.unread(this.state.resolvedAt)
    );
  }

  resolve(at: Date): Notice {
    if (this.state.resolvedAt) {
      return this;
    }

    const resolved = new Notice({ ...this.state, resolvedAt: at });
    resolved.inheritEvents(this);
    resolved.record(
      new NoticeResolved(
        this.state.id,
        this.state.workspaceId,
        this.state.addressee,
        at,
      ),
    );

    return resolved;
  }

  reopen(at: Date): Notice {
    if (!Notice.reopenable(this.state.resolvedAt)) {
      return this;
    }

    const reopened = new Notice({ ...this.state, resolvedAt: null });
    reopened.inheritEvents(this);
    reopened.record(
      new NoticeReopened(
        reopened.state.id,
        reopened.state.workspaceId,
        reopened.state.teamId,
        reopened.state.addressee,
        at,
      ),
    );

    return reopened;
  }
}
