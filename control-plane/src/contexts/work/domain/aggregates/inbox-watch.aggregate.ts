import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxItemArrived } from '@work/domain/events/inbox-item-arrived.event';
import {
  announcementKey,
  type InboxAnnouncement,
  type InboxRecount,
  type InboxSighting,
  type InboxWatcher,
  watcherKey,
} from '@work/domain/value-objects/inbox-sighting.vo';

const FRESH_FOR_MS = 10 * 60_000;

interface Recount {
  readonly requestedAt: Date;
  readonly job: PendingJob;
}

interface InboxWatchState {
  readonly workspaceId: WorkspaceId;
  readonly watching: readonly string[];
  readonly announced: readonly InboxAnnouncement[];
  readonly sightedAt: Date | null;
  readonly recount: Recount | null;
  readonly version: number;
}

export interface InboxWatchSnapshot {
  readonly workspaceId: WorkspaceId;
  readonly watching: readonly string[];
  readonly announced: readonly InboxAnnouncement[];
  readonly sightedAt: Date | null;
  readonly recount: InboxRecount | null;
  readonly version: number;
}

export class InboxWatch
  extends EventRecorder
  implements HasPendingJob<InboxWatch>
{
  private constructor(private readonly state: InboxWatchState) {
    super();
  }

  static start(workspaceId: WorkspaceId): InboxWatch {
    return new InboxWatch({
      workspaceId,
      watching: [],
      announced: [],
      sightedAt: null,
      recount: null,
      version: 0,
    });
  }

  static rehydrate(snapshot: InboxWatchSnapshot): InboxWatch {
    if (snapshot.version < 0) {
      throw new InconsistentStateError('inbox watch', 'has a negative version');
    }

    const keys = new Set(
      snapshot.announced.map((each) =>
        announcementKey(each.person, each.itemId),
      ),
    );

    if (keys.size !== snapshot.announced.length) {
      throw new InconsistentStateError(
        'inbox watch',
        'announced the same item twice to one person',
      );
    }

    return new InboxWatch({
      ...snapshot,
      recount: snapshot.recount
        ? {
            requestedAt: snapshot.recount.requestedAt,
            job: PendingJob.rehydrate({
              attempts: snapshot.recount.attempts,
              nextAttemptAt: snapshot.recount.dueAt,
            }),
          }
        : null,
    });
  }

  static isFresh(askedAt: Date, at: Date): boolean {
    return at.getTime() - askedAt.getTime() <= FRESH_FOR_MS;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get watching(): readonly string[] {
    return this.state.watching;
  }

  get announced(): readonly InboxAnnouncement[] {
    return this.state.announced;
  }

  get sightedAt(): Date | null {
    return this.state.sightedAt;
  }

  get recount(): InboxRecount | null {
    const recount = this.state.recount;

    return recount
      ? {
          requestedAt: recount.requestedAt,
          attempts: recount.job.attempts,
          dueAt: recount.job.nextAttemptAt,
        }
      : null;
  }

  get version(): number {
    return this.state.version;
  }

  get hasPendingJob(): boolean {
    return this.state.recount !== null;
  }

  get jobExhausted(): boolean {
    return this.state.recount?.job.exhausted ?? false;
  }

  recountRequested(at: Date): InboxWatch {
    const recount = this.state.recount;

    return this.with({
      recount: { requestedAt: at, job: recount?.job ?? PendingJob.fresh() },
    });
  }

  leaseJob(now: Date): InboxWatch {
    const recount = this.state.recount;

    if (!recount || !recount.job.isDue(now) || recount.job.exhausted) {
      throw new InconsistentStateError(
        'inbox watch',
        'has no recount that is due',
      );
    }

    return this.with({ recount: { ...recount, job: recount.job.lease(now) } });
  }

  scheduleRetry(now: Date): InboxWatch {
    const recount = this.state.recount;

    return recount
      ? this.with({
          recount: { ...recount, job: recount.job.scheduleRetry(now) },
        })
      : this;
  }

  deadLetter(): InboxWatch {
    return this.with({ recount: null });
  }

  sighted(input: {
    readonly people: readonly InboxWatcher[];
    readonly sightings: readonly InboxSighting[];
    readonly readAt: Date;
  }): InboxWatch {
    const recount = this.recountAfterReadingAt(input.readAt);

    if (this.state.sightedAt && input.readAt <= this.state.sightedAt) {
      return this.with({ recount });
    }

    const watched = new Set(this.state.watching);
    const before = new Map(
      this.state.announced.map((each) => [
        announcementKey(each.person, each.itemId),
        each.askedAt.getTime(),
      ]),
    );
    const unread = input.sightings.filter((each) => each.unread);
    const arrivals = unread.filter((each) => {
      const last = before.get(announcementKey(each.person.value, each.itemId));

      if (last !== undefined) {
        return each.askedAt.getTime() > last;
      }

      return (
        watched.has(watcherKey(each.person.value, each.teamId.value)) ||
        InboxWatch.isFresh(each.askedAt, input.readAt)
      );
    });

    const next = this.with({
      watching: input.people.flatMap((each) =>
        each.teams.map((team) => watcherKey(each.person.value, team.value)),
      ),
      announced: unread.map((each) => ({
        person: each.person.value,
        itemId: each.itemId,
        askedAt: each.askedAt,
      })),
      sightedAt: input.readAt,
      recount,
    });

    for (const each of arrivals) {
      next.record(
        new InboxItemArrived(
          this.state.workspaceId,
          each.teamId,
          each.person,
          each.itemId,
          each.kind,
          each.title,
          each.summary,
          each.askedAt,
        ),
      );
    }

    return next;
  }

  private recountAfterReadingAt(readAt: Date): Recount | null {
    const recount = this.state.recount;

    return recount && recount.requestedAt >= readAt
      ? { requestedAt: recount.requestedAt, job: PendingJob.fresh() }
      : null;
  }

  private with(change: Partial<InboxWatchState>): InboxWatch {
    const next = new InboxWatch({ ...this.state, ...change });
    next.inheritEvents(this);

    return next;
  }
}
