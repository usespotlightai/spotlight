import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxEntrySummary,
  InboxReaderPort,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { InboxWatch } from '@work/domain/aggregates/inbox-watch.aggregate';
import { InboxWatchVersionConflictError } from '@work/domain/exceptions/inbox-watch-version-conflict.error';
import type { InboxWatchRepository } from '@work/domain/repositories/inbox-watch.repository';
import type { InboxSighting } from '@work/domain/value-objects/inbox-sighting.vo';

const RECOUNTS_AT_ONCE = 2;
const REQUEST_ATTEMPTS = 5;
const INBOXES_AT_ONCE = 4;

const sightingOf = (
  scope: InboxScope,
  entry: InboxEntrySummary,
): InboxSighting | null => {
  switch (entry.kind) {
    case 'task':
      return {
        person: scope.viewer,
        teamId: TeamId.of(entry.teamId),
        itemId: entry.id,
        kind: 'task',
        title: entry.title,
        summary: entry.lastNote?.body ?? entry.description,
        unread: entry.unread,
        askedAt: entry.askedAt,
      };
    case 'notice':
      return {
        person: scope.viewer,
        teamId: TeamId.of(entry.teamId),
        itemId: entry.id,
        kind: 'notice',
        title: entry.headline,
        summary: entry.points[0] ?? null,
        unread: entry.unread,
        askedAt: entry.askedAt,
      };
    default:
      return null;
  }
};

export class InboxArrivals implements PendingJobsPort {
  readonly name = 'Announcing inbox arrivals';

  readonly #loop: JobLoop<InboxWatch, WorkspaceId>;
  readonly #saved = new WeakSet<InboxWatch>();

  constructor(
    private readonly watches: InboxWatchRepository,
    private readonly inbox: InboxReaderPort,
    private readonly access: WorkAccess,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<InboxWatch, WorkspaceId>(
      {
        name: this.name,
        batchSize: RECOUNTS_AT_ONCE,
        due: (now) => this.watches.nextDueJob(now),
        find: (workspaceId) => this.watches.find(workspaceId),
        save: (watch) =>
          this.#saved.has(watch) ? Promise.resolve() : this.watches.save(watch),
        keyOf: (watch) => watch.workspaceId,
        ids: (watch) => ({ workspaceId: watch.workspaceId.value }),
        about: (watch) => ({ attempts: watch.recount?.attempts }),
        process: (watch) => this.recounted(watch),
        stale: (error) => error instanceof InboxWatchVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  async requested(workspaceId: WorkspaceId): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const found = await this.watches.find(workspaceId);
        const requested = (
          found ?? InboxWatch.start(workspaceId)
        ).recountRequested(this.clock.now());

        await (found
          ? this.watches.save(requested)
          : this.watches.add(requested));
        return;
      } catch (error) {
        if (
          !(error instanceof InboxWatchVersionConflictError) ||
          attempt >= REQUEST_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async forget(workspaceId: WorkspaceId): Promise<void> {
    const found = await this.watches.find(workspaceId);

    if (found) {
      await this.watches.remove(found);
    }
  }

  private async recounted(watch: InboxWatch): Promise<InboxWatch> {
    const readAt = this.clock.now();
    const scopes = await this.access.memberInboxesIn(watch.workspaceId);
    const sightings: InboxSighting[] = [];

    for (let at = 0; at < scopes.length; at += INBOXES_AT_ONCE) {
      const batch = scopes.slice(at, at + INBOXES_AT_ONCE);
      const read = await Promise.all(
        batch.map(async (scope) =>
          (await this.inbox.open(scope)).flatMap(
            (entry) => sightingOf(scope, entry) ?? [],
          ),
        ),
      );

      sightings.push(...read.flat());
    }

    const people = scopes.map((each) => ({
      person: each.viewer,
      teams: [...each.teamsSeen].map((team) => TeamId.of(team)),
    }));

    for (let attempt = 1; ; attempt += 1) {
      const latest = (await this.watches.find(watch.workspaceId)) ?? watch;
      const sighted = latest.sighted({ people, sightings, readAt });

      try {
        await this.watches.save(sighted);
        this.#saved.add(sighted);
        return sighted;
      } catch (error) {
        if (
          !(error instanceof InboxWatchVersionConflictError) ||
          attempt >= REQUEST_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
