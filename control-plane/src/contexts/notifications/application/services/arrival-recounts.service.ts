import { ArrivalLedger } from '@notifications/domain/aggregates/arrival-ledger.aggregate';
import { ArrivalLedgerVersionConflictError } from '@notifications/domain/exceptions/arrival-ledger-version-conflict.error';
import type { ArrivalLedgerRepository } from '@notifications/domain/repositories/arrival-ledger.repository';
import type { InboxSighting } from '@notifications/domain/value-objects/inbox-sighting.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  MemberInbox,
  MemberInboxesPort,
} from '@work/application/ports/member-inboxes.port';

const RECOUNTS_AT_ONCE = 2;
const REQUEST_ATTEMPTS = 5;

const sightingsOf = (inbox: MemberInbox): InboxSighting[] =>
  inbox.items.map((item) => ({
    person: UserId.of(inbox.personId),
    teamId: TeamId.of(item.teamId),
    itemId: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    unread: item.unread,
    askedAt: item.askedAt,
  }));

export class ArrivalRecounts implements PendingJobsPort {
  readonly name = 'Announcing inbox arrivals';

  readonly #loop: JobLoop<ArrivalLedger, WorkspaceId>;
  readonly #saved = new WeakSet<ArrivalLedger>();

  constructor(
    private readonly ledgers: ArrivalLedgerRepository,
    private readonly inboxes: MemberInboxesPort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<ArrivalLedger, WorkspaceId>(
      {
        name: this.name,
        batchSize: RECOUNTS_AT_ONCE,
        due: (now) => this.ledgers.nextDueJob(now),
        find: (workspaceId) => this.ledgers.find(workspaceId),
        save: (ledger) =>
          this.#saved.has(ledger)
            ? Promise.resolve()
            : this.ledgers.save(ledger),
        keyOf: (ledger) => ledger.workspaceId,
        ids: (ledger) => ({ workspaceId: ledger.workspaceId.value }),
        about: (ledger) => ({ attempts: ledger.recount?.attempts }),
        process: (ledger) => this.recounted(ledger),
        stale: (error) => error instanceof ArrivalLedgerVersionConflictError,
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
        const found = await this.ledgers.find(workspaceId);
        const requested = (
          found ?? ArrivalLedger.start(workspaceId)
        ).recountRequested(this.clock.now());

        await (found
          ? this.ledgers.save(requested)
          : this.ledgers.add(requested));
        return;
      } catch (error) {
        if (
          !(error instanceof ArrivalLedgerVersionConflictError) ||
          attempt >= REQUEST_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async forget(workspaceId: WorkspaceId): Promise<void> {
    const found = await this.ledgers.find(workspaceId);

    if (found) {
      await this.ledgers.remove(found);
    }
  }

  private async recounted(ledger: ArrivalLedger): Promise<ArrivalLedger> {
    const readAt = this.clock.now();
    const inboxes = await this.inboxes.of(ledger.workspaceId.value);
    const sightings = inboxes.flatMap(sightingsOf);
    const people = inboxes.map((each) => ({
      person: UserId.of(each.personId),
      teams: each.teamsSeen.map((team) => TeamId.of(team)),
    }));

    for (let attempt = 1; ; attempt += 1) {
      const latest = (await this.ledgers.find(ledger.workspaceId)) ?? ledger;
      const sighted = latest.sighted({ people, sightings, readAt });

      try {
        await this.ledgers.save(sighted);
        this.#saved.add(sighted);
        return sighted;
      } catch (error) {
        if (
          !(error instanceof ArrivalLedgerVersionConflictError) ||
          attempt >= REQUEST_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
